import { z } from "zod";

export const auditQuerySchema = z.strictObject({
  organizationId: z.uuid(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
