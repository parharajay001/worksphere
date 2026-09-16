import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import { enqueueInvitationEmail } from "../../queue/email-queue.ts";
import type { CreateInvitationInput } from "./invitation.schemas.ts";
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function createInvitation(
  inviterId: string,
  input: CreateInvitationInput,
) {
  await requirePermission(inviterId, input.organizationId, "members:manage");
  const token = randomBytes(32).toString("base64url");
  try {
    const invitation = await database.invitation.create({
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
  await database.$transaction([
    database.membership.upsert({
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
    }),
    database.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);
}
export async function revokeInvitation(userId: string, id: string) {
  const invitation = await database.invitation.findUnique({
    where: { id },
    select: { organizationId: true, status: true },
  });
  if (!invitation) throw new AppError("NOT_FOUND");
  await requirePermission(userId, invitation.organizationId, "members:manage");
  if (invitation.status !== "PENDING") throw new AppError("BAD_REQUEST");
  return database.invitation.update({
    where: { id },
    data: { status: "REVOKED" },
    select: { id: true, status: true },
  });
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
