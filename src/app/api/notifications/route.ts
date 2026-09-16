import { createApiHandler } from "@/lib/api/handler";
import { parseQuery } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { notificationQuerySchema } from "@/modules/notifications/notification.schemas";
import { listNotifications } from "@/modules/notifications/notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createApiHandler(
  { route: "/api/notifications" },
  async (request) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    return success(
      await listNotifications(
        user.id,
        await parseQuery(request, notificationQuerySchema),
      ),
    );
  },
);
