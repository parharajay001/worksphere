import type { NotificationKind } from "../../generated/prisma/client.ts";

export const notificationEventMap = {
  "mention.created": "MENTION",
  "invitation.accepted": "INVITATION",
  "task.assigned": "ASSIGNMENT",
  "task.status_changed": "STATUS_CHANGE",
  "task.reminder": "REMINDER",
} as const satisfies Record<string, NotificationKind>;

export function notificationKindForEvent(action: string) {
  return notificationEventMap[action as keyof typeof notificationEventMap];
}
