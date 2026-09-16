import { z } from "zod";

export const createCommentSchema = z.strictObject({
  body: z.string().trim().min(1).max(5000),
});

export const updateCommentSchema = createCommentSchema;

export const commentIdSchema = z.strictObject({ id: z.string().uuid() });

export const commentQuerySchema = z.strictObject({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
