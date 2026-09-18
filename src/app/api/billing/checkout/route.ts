import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { parseJson } from "@/lib/api/validation";
import { getSessionUser } from "@/modules/auth/session";
import { billingPlanChangeSchema } from "@/modules/billing/billing.schemas";
import { startCheckout } from "@/modules/billing/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/billing/checkout" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const input = await parseJson(request, billingPlanChangeSchema);
    const returnUrl = new URL("/settings/billing", request.url).toString();
    return success(
      await startCheckout(user.id, input.organizationId, input.plan, returnUrl),
    );
  },
);
