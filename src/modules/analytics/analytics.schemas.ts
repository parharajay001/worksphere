import { z } from "zod";

export const analyticsQuerySchema = z
  .strictObject({
    organizationId: z.uuid(),
    projectId: z.uuid().optional(),
    teamId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
  });
