import "server-only";
import type { BillingPlan } from "../../generated/prisma/client.ts";

export type BillingProvider = {
  createCustomer(input: {
    organizationId: string;
    name: string;
  }): Promise<{ customerId: string }>;
  createCheckout(input: {
    organizationId: string;
    customerId: string;
    plan: Exclude<BillingPlan, "FREE">;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ checkoutUrl: string }>;
  cancelSubscription(input: {
    subscriptionId: string;
    atPeriodEnd: boolean;
  }): Promise<void>;
};
