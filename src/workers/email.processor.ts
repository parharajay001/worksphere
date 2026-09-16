import "server-only";
import { createHash } from "node:crypto";
import type { Job } from "bullmq";
import { database } from "../database/client.ts";
import {
  deliverInvitationEmail,
  type EmailDelivery,
} from "../modules/notifications/email.ts";
import type { EmailJobMap } from "../queue/contracts.ts";

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

type InvitationLookup = (query: {
  where: {
    id: string;
    tokenHash: string;
    status: "PENDING";
    expiresAt: { gt: Date };
  };
  select: {
    email: true;
    organization: { select: { name: true } };
  };
}) => Promise<{
  email: string;
  organization: { name: string };
} | null>;

export function createEmailProcessor(
  dependencies: {
    findInvitation?: InvitationLookup;
    deliver?: EmailDelivery;
  } = {},
) {
  const findInvitation: InvitationLookup =
    dependencies.findInvitation ??
    ((query) => database.invitation.findFirst(query));
  const deliver = dependencies.deliver ?? deliverInvitationEmail;

  return async function processEmailJob(
    job: Job<EmailJobMap[keyof EmailJobMap], void, keyof EmailJobMap>,
  ) {
    if (job.name !== "invitation.email")
      throw new Error(`Unsupported email job: ${job.name}`);

    const invitation = await findInvitation({
      where: {
        id: job.data.invitationId,
        tokenHash: hash(job.data.token),
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: {
        email: true,
        organization: { select: { name: true } },
      },
    });

    // A revoked, accepted, expired, or replaced invitation is a successful no-op.
    if (!invitation) return;
    await deliver({
      to: invitation.email,
      organizationName: invitation.organization.name,
      token: job.data.token,
      idempotencyKey: job.id ?? `invitation-email-${job.data.invitationId}`,
    });
  };
}
