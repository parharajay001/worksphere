import { z } from "zod";

const schema = z.object({
  BILLING_WEBHOOK_SECRET: z.string().min(32).max(512),
});

export function parseBillingEnvironment(
  values: Record<string, string | undefined>,
) {
  const result = schema.safeParse(values);
  if (!result.success)
    throw new Error(
      "Invalid environment: BILLING_WEBHOOK_SECRET. Check .env.example and your environment configuration.",
    );
  return result.data;
}
