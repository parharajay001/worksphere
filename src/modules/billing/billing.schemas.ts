import { z } from "zod";

export const billingQuerySchema = z.strictObject({ organizationId: z.uuid() });
export const billingProviderSchema = z.strictObject({
  provider: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
});
export const billingActionSchema = z.strictObject({
  organizationId: z.uuid(),
});
export const billingPlanChangeSchema = z.strictObject({
  organizationId: z.uuid(),
  plan: z.enum(["PRO", "TEAM"]),
});
export const billingWebhookSchema = z.strictObject({
  id: z.string().min(1).max(255),
  type: z.enum([
    "subscription.created",
    "subscription.updated",
    "subscription.canceled",
  ]),
  data: z.strictObject({
    organizationId: z.uuid(),
    customerId: z.string().min(1).max(255),
    subscriptionId: z.string().min(1).max(255),
    plan: z.enum(["FREE", "PRO", "TEAM"]),
    status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"]),
    currentPeriodEnd: z.iso.datetime().nullable(),
    cancelAtPeriodEnd: z.boolean().default(false),
  }),
});
