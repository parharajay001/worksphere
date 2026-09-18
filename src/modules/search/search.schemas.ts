import { z } from "zod";
export const searchQuerySchema = z.strictObject({
  q: z.string().trim().min(2).max(100),
});
