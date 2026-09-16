import type { NotificationKind } from "../../generated/prisma/client.ts";

export const notificationEventMap = {
  "mention.created": "MENTION",
} as const satisfies Record<string, NotificationKind>;

export function notificationKindForEvent(action: string) {
  return notificationEventMap[action as keyof typeof notificationEventMap];
}
