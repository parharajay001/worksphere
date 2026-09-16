import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import type { z } from "zod";
import type { billingWebhookSchema } from "./billing.schemas.ts";
import { appendAuditEvent } from "../audit/audit.service.ts";

type BillingWebhook = z.infer<typeof billingWebhookSchema>;

export function verifyWebhookSignature(
  rawBody: Uint8Array,
  provided: string | null,
  secret: string,
) {
  if (!provided || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const candidate = Buffer.from(provided, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

export async function processBillingWebhook(
  provider: string,
  event: BillingWebhook,
  rawBody: Uint8Array,
) {
  return database.$transaction(async (tx) => {
    const inserted = await tx.billingWebhookEvent.createMany({
      data: {
        provider,
        externalEventId: event.id,
        eventType: event.type,
        payloadHash: createHash("sha256").update(rawBody).digest("hex"),
        organizationId: event.data.organizationId,
      },
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { duplicate: true };

    await tx.billingSubscription.upsert({
      where: { organizationId: event.data.organizationId },
      create: {
        organizationId: event.data.organizationId,
        provider,
        externalCustomerId: event.data.customerId,
        externalSubscriptionId: event.data.subscriptionId,
        plan: event.data.plan,
        status: event.data.status,
        currentPeriodEnd: event.data.currentPeriodEnd
          ? new Date(event.data.currentPeriodEnd)
          : null,
        cancelAtPeriodEnd: event.data.cancelAtPeriodEnd,
      },
      update: {
        provider,
        externalCustomerId: event.data.customerId,
        externalSubscriptionId: event.data.subscriptionId,
        plan: event.data.plan,
        status: event.data.status,
        currentPeriodEnd: event.data.currentPeriodEnd
          ? new Date(event.data.currentPeriodEnd)
          : null,
        cancelAtPeriodEnd: event.data.cancelAtPeriodEnd,
      },
    });
    await tx.billingWebhookEvent.update({
      where: {
        provider_externalEventId: { provider, externalEventId: event.id },
      },
      data: { processedAt: new Date() },
    });
    await appendAuditEvent(tx, {
      tenantId: event.data.organizationId,
      action: "billing.subscription_changed",
      targetType: "subscription",
      targetId: event.data.subscriptionId,
      metadata: {
        plan: event.data.plan,
        status: event.data.status,
        eventType: event.type,
      },
    });
    return { duplicate: false };
  });
}

export async function readWebhookBody(request: Request, maxBytes = 64 * 1024) {
  if (!request.body) throw new AppError("INVALID_JSON");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
