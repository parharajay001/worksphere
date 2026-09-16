import { createApiHandler } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { billingQuerySchema } from "@/modules/billing/billing.schemas";
import { getBillingSnapshot } from "@/modules/billing/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/billing" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { organizationId } = await parseQuery(request, billingQuerySchema);
    return success({
      billing: await getBillingSnapshot(user.id, organizationId),
    });
  },
);
