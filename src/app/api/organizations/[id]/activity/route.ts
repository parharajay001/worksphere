import { createApiHandler } from "@/lib/api/handler";
import { parseParams, parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { organizationIdSchema } from "@/modules/organizations/organization.schemas";
import { activityQuerySchema } from "@/modules/activity/activity.schemas";
import { listActivity } from "@/modules/activity/activity.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { route: "/api/organizations/:id/activity" },
  async (request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, organizationIdSchema);
    const query = await parseQuery(request, activityQuerySchema);
    return success(await listActivity(user.id, { organizationId: id }, query));
  },
);
