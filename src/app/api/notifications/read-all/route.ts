import { createApiHandler } from "@/lib/api/handler";
import { success } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { getSessionUser } from "@/modules/auth/session";
import { markAllNotificationsRead } from "@/modules/notifications/notification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createApiHandler(
  { route: "/api/notifications/read-all" },
  async () => {
    const user = await getSessionUser();
    if (!user) throw new AppError("UNAUTHENTICATED");
    await markAllNotificationsRead(user.id);
    return success({ read: true });
  },
);
