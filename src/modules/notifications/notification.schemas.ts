import { z } from "zod";

export const notificationQuerySchema = z.strictObject({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const notificationIdSchema = z.strictObject({ id: z.string().uuid() });

export const notificationPreferencesSchema = z.strictObject({
  mentionInApp: z.boolean(),
  mentionEmail: z.boolean(),
  invitationInApp: z.boolean(),
  assignmentInApp: z.boolean(),
  statusChangeInApp: z.boolean(),
  reminderInApp: z.boolean(),
});
