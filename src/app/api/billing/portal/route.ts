import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { parseJson } from "@/lib/api/validation";
import { getSessionUser } from "@/modules/auth/session";
import { billingActionSchema } from "@/modules/billing/billing.schemas";
import { openCustomerPortal } from "@/modules/billing/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/billing/portal" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { organizationId } = await parseJson(request, billingActionSchema);
    const returnUrl = new URL("/settings/billing", request.url).toString();
    return success(
      await openCustomerPortal(user.id, organizationId, returnUrl),
    );
  },
);
