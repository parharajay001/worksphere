import { createApiHandler } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { analyticsQuerySchema } from "@/modules/analytics/analytics.schemas";
import { getAnalytics } from "@/modules/analytics/analytics.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/analytics" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { organizationId, ...query } = await parseQuery(
      request,
      analyticsQuerySchema,
    );
    return success(await getAnalytics(user.id, organizationId, query));
  },
);
