import "server-only";

export type MentionNotification = {
  recipientId: string;
  actorId: string;
  taskId: string;
  commentId: string;
};

// Day 17 will enqueue this provider. Keeping the seam here avoids coupling
// comment writes to email, WebSocket, or the future Notification model.
export async function deliverMentionNotification(
  notification: MentionNotification,
) {
  void notification;
  return undefined;
}
