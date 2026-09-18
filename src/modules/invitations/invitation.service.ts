import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import { enqueueInvitationEmail } from "../../queue/email-queue.ts";
import type { CreateInvitationInput } from "./invitation.schemas.ts";
import { appendAuditEvent } from "../audit/audit.service.ts";
import { createAppNotification } from "../notifications/notification.service.ts";
import { assertMemberAllowance } from "../billing/billing.service.ts";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createInvitation(
  inviterId: string,
  input: CreateInvitationInput,
) {
  await requirePermission(inviterId, input.organizationId, "members:manage");
  const token = randomBytes(32).toString("base64url");
  try {
    const invitation = await database.$transaction(async (tx) => {
      await assertMemberAllowance(tx, input.organizationId);
      const created = await tx.invitation.create({
        data: {
          organizationId: input.organizationId,
          inviterId,
          email: input.email,
          role: input.role,
          tokenHash: hash(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          organization: { select: { name: true } },
        },
      });
      await appendAuditEvent(tx, {
        tenantId: input.organizationId,
        actorId: inviterId,
        action: "invitation.created",
        targetType: "invitation",
        targetId: created.id,
        metadata: { role: input.role },
      });
      await tx.activityEvent.create({
        data: {
          organizationId: input.organizationId,
          actorId: inviterId,
          action: "member.invited",
          metadata: { invitationId: created.id, email: input.email },
        },
      });
      return created;
    });
    await enqueueInvitationEmail({
      invitationId: invitation.id,
      token,
    });
    return { ...invitation, token };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError("CONFLICT");
    throw error;
  }
}
export async function acceptInvitation(userId: string, token: string) {
  const invitation = await database.invitation.findUnique({
    where: { tokenHash: hash(token) },
  });
  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt <= new Date()
  )
    throw new AppError("BAD_REQUEST");
  const user = await database.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });
  if (user.email !== invitation.email) throw new AppError("FORBIDDEN");
  await database.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId,
        },
      },
      create: {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
      },
      update: { role: invitation.role },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    await appendAuditEvent(tx, {
      tenantId: invitation.organizationId,
      actorId: userId,
      action: "invitation.accepted",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { role: invitation.role },
    });
    await createAppNotification(tx, {
      kind: "INVITATION",
      recipientId: userId,
      actorId: invitation.inviterId,
      organizationId: invitation.organizationId,
      metadata: { organizationId: invitation.organizationId },
    });
  });
}
export async function revokeInvitation(userId: string, id: string) {
  const invitation = await database.invitation.findUnique({
    where: { id },
    select: { organizationId: true, status: true },
  });
  if (!invitation) throw new AppError("NOT_FOUND");
  await requirePermission(userId, invitation.organizationId, "members:manage");
  if (invitation.status !== "PENDING") throw new AppError("BAD_REQUEST");
  return database.$transaction(async (tx) => {
    const revoked = await tx.invitation.update({
      where: { id },
      data: { status: "REVOKED" },
      select: { id: true, status: true },
    });
    await appendAuditEvent(tx, {
      tenantId: invitation.organizationId,
      actorId: userId,
      action: "invitation.revoked",
      targetType: "invitation",
      targetId: id,
    });
    return revoked;
  });
}
export async function resendInvitation(userId: string, id: string) {
  const invitation = await database.invitation.findUnique({
    where: { id },
    select: { organizationId: true, status: true },
  });
  if (!invitation) throw new AppError("NOT_FOUND");
  await requirePermission(userId, invitation.organizationId, "members:manage");
  if (invitation.status !== "PENDING") throw new AppError("BAD_REQUEST");
  const token = randomBytes(32).toString("base64url");
  const updated = await database.invitation.update({
    where: { id },
    data: {
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
    },
  });
  await enqueueInvitationEmail({ invitationId: id, token });
  return { ...updated, token };
}
export async function listInvitations(userId: string, organizationId: string) {
  await requirePermission(userId, organizationId, "members:read");
  return database.invitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
    },
  });
}
