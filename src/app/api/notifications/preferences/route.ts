import { createApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { success } from "@/lib/api/response";
import { parseJson } from "@/lib/api/validation";
import { getSessionUser } from "@/modules/auth/session";
import { notificationPreferencesSchema } from "@/modules/notifications/notification.schemas";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/modules/notifications/preferences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function userId() {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user.id;
}

export const GET = createApiHandler(
  { route: "/api/notifications/preferences" },
  async () => success(await getNotificationPreferences(await userId())),
);

export const PATCH = createApiHandler(
  { route: "/api/notifications/preferences" },
  async (request) =>
    success(
      await updateNotificationPreferences(
        await userId(),
        await parseJson(request, notificationPreferencesSchema),
      ),
    ),
);
