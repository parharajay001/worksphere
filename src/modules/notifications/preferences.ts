import "server-only";

export type NotificationPreferences = {
  mentionInApp: boolean;
  mentionEmail: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  mentionInApp: true,
  mentionEmail: false,
};

// The persistence boundary is intentionally small so user settings can move
// to a database or settings provider without changing notification producers.
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  void userId;
  return { ...defaultNotificationPreferences };
}
