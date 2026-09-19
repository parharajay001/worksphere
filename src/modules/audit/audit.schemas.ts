import { z } from "zod";

export const auditQuerySchema = z
  .strictObject({
    organizationId: z.uuid(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    action: z.string().trim().min(1).max(80).optional(),
    actorId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
  });
