ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'INVITATION';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'ASSIGNMENT';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'STATUS_CHANGE';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'REMINDER';

ALTER TABLE "ActivityEvent" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "ActivityEvent" ADD COLUMN "organizationId" UUID;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ActivityEvent_organizationId_createdAt_idx" ON "ActivityEvent"("organizationId", "createdAt");

CREATE TABLE "NotificationPreference" (
  "userId" UUID NOT NULL,
  "mentionInApp" BOOLEAN NOT NULL DEFAULT true,
  "mentionEmail" BOOLEAN NOT NULL DEFAULT false,
  "invitationInApp" BOOLEAN NOT NULL DEFAULT true,
  "assignmentInApp" BOOLEAN NOT NULL DEFAULT true,
  "statusChangeInApp" BOOLEAN NOT NULL DEFAULT true,
  "reminderInApp" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
