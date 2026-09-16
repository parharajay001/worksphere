import { createApiHandler } from "@/lib/api/handler";
import { parseInput, parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { parseBillingEnvironment } from "@/config/billing";
import {
  billingProviderSchema,
  billingWebhookSchema,
} from "@/modules/billing/billing.schemas";
import {
  processBillingWebhook,
  readWebhookBody,
  verifyWebhookSignature,
} from "@/modules/billing/webhook.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = createApiHandler(
  { route: "/api/billing/webhooks/:provider", csrf: false },
  async (request, context) => {
    const { provider } = await parseParams(
      context.params,
      billingProviderSchema,
    );
    const rawBody = await readWebhookBody(request);
    const secret = parseBillingEnvironment(process.env).BILLING_WEBHOOK_SECRET;
    if (
      !verifyWebhookSignature(
        rawBody,
        request.headers.get("x-worksphere-signature"),
        secret,
      )
    )
      throw new AppError("UNAUTHENTICATED");
    let candidate: unknown;
    try {
      candidate = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(rawBody),
      );
    } catch (error) {
      throw new AppError("INVALID_JSON", { cause: error });
    }
    const event = await parseInput(billingWebhookSchema, candidate);
    return success(await processBillingWebhook(provider, event, rawBody));
  },
);
