import "server-only";
import { randomUUID } from "node:crypto";
import type { BillingPlan } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";

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
  createCustomerPortal(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ portalUrl: string }>;
  changeSubscription(input: {
    subscriptionId: string;
    plan: Exclude<BillingPlan, "FREE">;
  }): Promise<void>;
  cancelSubscription(input: {
    subscriptionId: string;
    atPeriodEnd: boolean;
  }): Promise<void>;
};

function localReturnUrl(value: string) {
  const url = new URL(value);
  url.searchParams.set("billing", "updated");
  return url.toString();
}

// Local provider keeps development and portfolio demos fully functional. A
// hosted provider can implement the same seam without changing routes or UI.
export const localBillingProvider: BillingProvider = {
  async createCustomer({ organizationId }) {
    return { customerId: `local_customer_${organizationId}` };
  },
  async createCheckout(input) {
    await database.billingSubscription.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        provider: "local",
        externalCustomerId: input.customerId,
        externalSubscriptionId: `local_subscription_${randomUUID()}`,
        plan: input.plan,
        status: "TRIALING",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
      update: {
        plan: input.plan,
        status: "TRIALING",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    return { checkoutUrl: localReturnUrl(input.successUrl) };
  },
  async createCustomerPortal({ returnUrl }) {
    return { portalUrl: localReturnUrl(returnUrl) };
  },
  async changeSubscription({ subscriptionId, plan }) {
    const result = await database.billingSubscription.updateMany({
      where: { externalSubscriptionId: subscriptionId },
      data: { plan, status: "ACTIVE", cancelAtPeriodEnd: false },
    });
    if (!result.count) throw new AppError("NOT_FOUND");
  },
  async cancelSubscription({ subscriptionId, atPeriodEnd }) {
    const result = await database.billingSubscription.updateMany({
      where: { externalSubscriptionId: subscriptionId },
      data: atPeriodEnd
        ? { cancelAtPeriodEnd: true }
        : { status: "CANCELED", cancelAtPeriodEnd: false },
    });
    if (!result.count) throw new AppError("NOT_FOUND");
  },
};

export function getBillingProvider() {
  if (process.env.BILLING_PROVIDER && process.env.BILLING_PROVIDER !== "local")
    throw new AppError("SERVICE_UNAVAILABLE");
  return localBillingProvider;
}
