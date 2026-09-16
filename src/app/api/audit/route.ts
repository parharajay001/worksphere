import { createApiHandler } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { auditQuerySchema } from "@/modules/audit/audit.schemas";
import { listAuditEvents } from "@/modules/audit/audit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = createApiHandler(
  { route: "/api/audit" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    return success({
      events: await listAuditEvents(
        user.id,
        await parseQuery(request, auditQuerySchema),
      ),
    });
  },
);
