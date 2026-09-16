import { z } from "zod";

export const activityQuerySchema = z.strictObject({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

export const activityIdSchema = z.strictObject({ id: z.string().uuid() });
