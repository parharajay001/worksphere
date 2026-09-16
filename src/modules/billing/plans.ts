import type { BillingPlan } from "../../generated/prisma/client.ts";

export const planEntitlements = {
  FREE: { projects: 3, members: 5, chatMessagesPerMonth: 500 },
  PRO: { projects: 25, members: 50, chatMessagesPerMonth: 10_000 },
  TEAM: { projects: null, members: 500, chatMessagesPerMonth: 100_000 },
} as const satisfies Record<
  BillingPlan,
  { projects: number | null; members: number; chatMessagesPerMonth: number }
>;

export type PlanEntitlements = (typeof planEntitlements)[BillingPlan];
