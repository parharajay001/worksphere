import { createApiHandler } from "@/lib/api/handler";
import { parseParams } from "@/lib/api/validation";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { notificationIdSchema } from "@/modules/notifications/notification.schemas";
import { markNotificationRead } from "@/modules/notifications/notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/notifications/:id/read" },
  async (_request, context) => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    const { id } = await parseParams(context.params, notificationIdSchema);
    await markNotificationRead(user.id, id);
    return success({ read: true });
  },
);
