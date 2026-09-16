import { z } from "zod";

export const analyticsQuerySchema = z.strictObject({
  organizationId: z.uuid(),
});
