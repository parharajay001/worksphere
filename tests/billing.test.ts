import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { parseBillingEnvironment } from "../src/config/billing.ts";
import { billingWebhookSchema } from "../src/modules/billing/billing.schemas.ts";
import { planEntitlements } from "../src/modules/billing/plans.ts";

test("plan entitlements increase predictably and Team projects are unlimited", () => {
  assert.ok(planEntitlements.FREE.projects! < planEntitlements.PRO.projects!);
  assert.equal(planEntitlements.TEAM.projects, null);
  assert.ok(
    planEntitlements.FREE.chatMessagesPerMonth <
      planEntitlements.PRO.chatMessagesPerMonth,
  );
});

test("billing webhook configuration never accepts short secrets", () => {
  assert.throws(
    () => parseBillingEnvironment({ BILLING_WEBHOOK_SECRET: "short" }),
    /BILLING_WEBHOOK_SECRET/,
  );
  assert.equal(
    parseBillingEnvironment({ BILLING_WEBHOOK_SECRET: "x".repeat(32) })
      .BILLING_WEBHOOK_SECRET.length,
    32,
  );
});

test("webhook signatures authenticate exact raw bytes", async () => {
  process.env.DATABASE_URL ??=
    "postgresql://worksphere:worksphere_local@localhost:54329/worksphere?schema=public";
  const { verifyWebhookSignature } =
    await import("../src/modules/billing/webhook.service.ts");
  const body = new TextEncoder().encode('{"id":"event-1"}');
  const secret = "s".repeat(32);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(
    verifyWebhookSignature(
      new TextEncoder().encode('{"id":"event-2"}'),
      signature,
      secret,
    ),
    false,
  );
  assert.equal(verifyWebhookSignature(body, "invalid", secret), false);
});

test("webhook payloads reject unknown event fields and invalid plans", () => {
  const valid = {
    id: "event-1",
    type: "subscription.updated",
    data: {
      organizationId: "20000000-0000-4000-8000-000000000001",
      customerId: "customer-1",
      subscriptionId: "subscription-1",
      plan: "PRO",
      status: "ACTIVE",
      currentPeriodEnd: "2026-10-16T00:00:00.000Z",
    },
  };
  assert.equal(billingWebhookSchema.safeParse(valid).success, true);
  assert.equal(
    billingWebhookSchema.safeParse({
      ...valid,
      data: { ...valid.data, plan: "ENTERPRISE" },
    }).success,
    false,
  );
  assert.equal(
    billingWebhookSchema.safeParse({ ...valid, secret: "leak" }).success,
    false,
  );
});
