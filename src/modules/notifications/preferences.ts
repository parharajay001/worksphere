import "server-only";
import { database } from "../../database/client.ts";

export type NotificationPreferences = {
  mentionInApp: boolean;
  mentionEmail: boolean;
  invitationInApp: boolean;
  assignmentInApp: boolean;
  statusChangeInApp: boolean;
  reminderInApp: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  mentionInApp: true,
  mentionEmail: false,
  invitationInApp: true,
  assignmentInApp: true,
  statusChangeInApp: true,
  reminderInApp: true,
};

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  return (
    (await database.notificationPreference.findUnique({
      where: { userId },
      select: {
        mentionInApp: true,
        mentionEmail: true,
        invitationInApp: true,
        assignmentInApp: true,
        statusChangeInApp: true,
        reminderInApp: true,
      },
    })) ?? { ...defaultNotificationPreferences }
  );
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  return database.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...preferences },
    update: preferences,
    select: {
      mentionInApp: true,
      mentionEmail: true,
      invitationInApp: true,
      assignmentInApp: true,
      statusChangeInApp: true,
      reminderInApp: true,
    },
  });
}
