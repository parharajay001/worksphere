CREATE TYPE "BillingPlan" AS ENUM ('FREE', 'PRO', 'TEAM');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "UsageMetric" AS ENUM ('CHAT_MESSAGES');

CREATE TABLE "BillingSubscription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL, "externalCustomerId" VARCHAR(255),
  "externalSubscriptionId" VARCHAR(255), "plan" "BillingPlan" NOT NULL DEFAULT 'FREE',
  "status" "SubscriptionStatus" NOT NULL, "currentPeriodEnd" TIMESTAMPTZ(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UsageCounter" (
  "organizationId" UUID NOT NULL, "metric" "UsageMetric" NOT NULL,
  "periodStart" DATE NOT NULL, "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("organizationId", "metric", "periodStart"),
  CONSTRAINT "UsageCounter_count_nonnegative" CHECK ("count" >= 0)
);
CREATE TABLE "BillingWebhookEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "provider" VARCHAR(40) NOT NULL,
  "externalEventId" VARCHAR(255) NOT NULL, "eventType" VARCHAR(80) NOT NULL,
  "payloadHash" CHAR(64) NOT NULL, "organizationId" UUID,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMPTZ(3),
  CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingSubscription_organizationId_key" ON "BillingSubscription"("organizationId");
CREATE UNIQUE INDEX "BillingSubscription_provider_externalCustomerId_key" ON "BillingSubscription"("provider", "externalCustomerId");
CREATE UNIQUE INDEX "BillingSubscription_provider_externalSubscriptionId_key" ON "BillingSubscription"("provider", "externalSubscriptionId");
CREATE INDEX "BillingSubscription_status_currentPeriodEnd_idx" ON "BillingSubscription"("status", "currentPeriodEnd");
CREATE INDEX "UsageCounter_metric_periodStart_idx" ON "UsageCounter"("metric", "periodStart");
CREATE UNIQUE INDEX "BillingWebhookEvent_provider_externalEventId_key" ON "BillingWebhookEvent"("provider", "externalEventId");
CREATE INDEX "BillingWebhookEvent_organizationId_receivedAt_idx" ON "BillingWebhookEvent"("organizationId", "receivedAt");
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingWebhookEvent" ADD CONSTRAINT "BillingWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
