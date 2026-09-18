import "server-only";
import type { BillingPlan, Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import { planEntitlements } from "./plans.ts";
import { getBillingProvider } from "./provider.ts";

type Db = Prisma.TransactionClient;

export function monthStart(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export async function effectivePlan(client: Db, organizationId: string) {
  const subscription = await client.billingSubscription.findUnique({
    where: { organizationId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status))
    return "FREE" as BillingPlan;
  if (
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd <= new Date()
  )
    return "FREE" as BillingPlan;
  return subscription.plan;
}

export async function assertProjectAllowance(
  client: Db,
  organizationId: string,
) {
  await client.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
  const plan = await effectivePlan(client, organizationId);
  const limit = planEntitlements[plan].projects;
  if (limit === null) return;
  const count = await client.project.count({
    where: { organizationId, status: "ACTIVE" },
  });
  if (count >= limit) throw new AppError("PLAN_LIMIT_REACHED");
}

export async function consumeChatMessage(
  client: Db,
  organizationId: string,
  at = new Date(),
) {
  const plan = await effectivePlan(client, organizationId);
  const limit = planEntitlements[plan].chatMessagesPerMonth;
  const counter = await client.usageCounter.upsert({
    where: {
      organizationId_metric_periodStart: {
        organizationId,
        metric: "CHAT_MESSAGES",
        periodStart: monthStart(at),
      },
    },
    create: {
      organizationId,
      metric: "CHAT_MESSAGES",
      periodStart: monthStart(at),
      count: 1,
    },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  if (counter.count > limit) throw new AppError("PLAN_LIMIT_REACHED");
  return { count: counter.count, limit };
}

export async function assertMemberAllowance(
  client: Db,
  organizationId: string,
) {
  const plan = await effectivePlan(client, organizationId);
  const limit = planEntitlements[plan].members;
  const [members, invitations] = await Promise.all([
    client.membership.count({ where: { organizationId } }),
    client.invitation.count({ where: { organizationId, status: "PENDING" } }),
  ]);
  if (members + invitations >= limit) throw new AppError("PLAN_LIMIT_REACHED");
}

export async function getBillingSnapshot(
  userId: string,
  organizationId: string,
) {
  await requirePermission(userId, organizationId, "organization:read");
  const [subscription, usage, projectCount, memberCount] = await Promise.all([
    database.billingSubscription.findUnique({ where: { organizationId } }),
    database.usageCounter.findUnique({
      where: {
        organizationId_metric_periodStart: {
          organizationId,
          metric: "CHAT_MESSAGES",
          periodStart: monthStart(),
        },
      },
      select: { count: true },
    }),
    database.project.count({ where: { organizationId, status: "ACTIVE" } }),
    database.membership.count({ where: { organizationId } }),
  ]);
  const plan = await effectivePlan(database, organizationId);
  return {
    plan,
    entitlements: planEntitlements[plan],
    subscription,
    usage: {
      projects: projectCount,
      members: memberCount,
      chatMessagesThisMonth: usage?.count ?? 0,
    },
  };
}

async function billingAdmin(userId: string, organizationId: string) {
  await requirePermission(userId, organizationId, "organization:update");
  return database.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true },
  });
}

export async function startCheckout(
  userId: string,
  organizationId: string,
  plan: "PRO" | "TEAM",
  returnUrl: string,
) {
  const organization = await billingAdmin(userId, organizationId);
  const provider = getBillingProvider();
  const subscription = await database.billingSubscription.findUnique({
    where: { organizationId },
    select: { externalCustomerId: true },
  });
  const customerId =
    subscription?.externalCustomerId ??
    (await provider.createCustomer({ organizationId, name: organization.name }))
      .customerId;
  return provider.createCheckout({
    organizationId,
    customerId,
    plan,
    successUrl: returnUrl,
    cancelUrl: returnUrl,
  });
}

export async function openCustomerPortal(
  userId: string,
  organizationId: string,
  returnUrl: string,
) {
  await billingAdmin(userId, organizationId);
  const subscription = await database.billingSubscription.findUnique({
    where: { organizationId },
    select: { externalCustomerId: true },
  });
  if (!subscription?.externalCustomerId) throw new AppError("BAD_REQUEST");
  return getBillingProvider().createCustomerPortal({
    customerId: subscription.externalCustomerId,
    returnUrl,
  });
}

export async function changePlan(
  userId: string,
  organizationId: string,
  plan: "PRO" | "TEAM",
) {
  await billingAdmin(userId, organizationId);
  const subscription = await database.billingSubscription.findUnique({
    where: { organizationId },
    select: { externalSubscriptionId: true },
  });
  if (!subscription?.externalSubscriptionId) throw new AppError("BAD_REQUEST");
  await getBillingProvider().changeSubscription({
    subscriptionId: subscription.externalSubscriptionId,
    plan,
  });
}

export async function cancelPlan(userId: string, organizationId: string) {
  await billingAdmin(userId, organizationId);
  const subscription = await database.billingSubscription.findUnique({
    where: { organizationId },
    select: { externalSubscriptionId: true },
  });
  if (!subscription?.externalSubscriptionId) throw new AppError("BAD_REQUEST");
  await getBillingProvider().cancelSubscription({
    subscriptionId: subscription.externalSubscriptionId,
    atPeriodEnd: true,
  });
}
