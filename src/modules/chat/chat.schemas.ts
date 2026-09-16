import { z } from "zod";

export const conversationIdSchema = z.strictObject({ id: z.uuid() });
export const createConversationSchema = z
  .strictObject({ projectId: z.uuid().optional(), teamId: z.uuid().optional() })
  .refine((value) => Boolean(value.projectId) !== Boolean(value.teamId));
export const messageQuerySchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export const createMessageSchema = z.strictObject({
  body: z.string().trim().min(1).max(4000),
});
