import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { parseJson } from "@/lib/api/validation";
import { getSessionUser } from "@/modules/auth/session";
import {
  billingActionSchema,
  billingPlanChangeSchema,
} from "@/modules/billing/billing.schemas";
import { cancelPlan, changePlan } from "@/modules/billing/billing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userId() {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user.id;
}

export const PATCH = createApiHandler(
  { route: "/api/billing/subscription" },
  async (request) => {
    const input = await parseJson(request, billingPlanChangeSchema);
    await changePlan(await userId(), input.organizationId, input.plan);
    return success({ changed: true });
  },
);

export const DELETE = createApiHandler(
  { route: "/api/billing/subscription" },
  async (request) => {
    const { organizationId } = await parseJson(request, billingActionSchema);
    await cancelPlan(await userId(), organizationId);
    return success({ canceled: true });
  },
);
