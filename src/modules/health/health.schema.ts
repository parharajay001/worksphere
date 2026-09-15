import { z } from "zod";

export const healthQuerySchema = z.strictObject({
  check: z.enum(["live", "database"]).default("live"),
});

export type HealthQuery = z.infer<typeof healthQuerySchema>;
