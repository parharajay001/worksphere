import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import {
  findMembership,
  listForUser,
  listMembers,
} from "./organization.repository.ts";
import type { CreateOrganizationInput } from "./organization.schemas.ts";
import { requirePermission } from "../authorization/guards.ts";
import { appendAuditEvent } from "../audit/audit.service.ts";

const slugify = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63) || "workspace";
export async function getOrganizations(userId: string) {
  return listForUser(userId);
}
export async function getOrganizationMembers(
  userId: string,
  organizationId: string,
) {
  await requirePermission(userId, organizationId, "members:read");
  return listMembers(organizationId);
}
export async function updateMemberRole(
  actorId: string,
  organizationId: string,
  memberId: string,
  role: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER",
) {
  const actor = await requirePermission(
    actorId,
    organizationId,
    "members:manage",
  );
  const target = await database.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: memberId } },
    select: { role: true },
  });
  if (!target) throw new AppError("NOT_FOUND");
  if (target.role === "OWNER") throw new AppError("FORBIDDEN");
  if (actor.role !== "OWNER" && role === "ADMIN")
    throw new AppError("FORBIDDEN");
  return database.membership.update({
    where: { organizationId_userId: { organizationId, userId: memberId } },
    data: { role },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
export async function removeOrganizationMember(
  actorId: string,
  organizationId: string,
  memberId: string,
) {
  await requirePermission(actorId, organizationId, "members:manage");
  const target = await database.membership.findUnique({
    where: { organizationId_userId: { organizationId, userId: memberId } },
    select: { role: true },
  });
  if (!target) throw new AppError("NOT_FOUND");
  if (target.role === "OWNER") throw new AppError("FORBIDDEN");
  await database.membership.delete({
    where: { organizationId_userId: { organizationId, userId: memberId } },
  });
}
export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
) {
  const slug = input.slug ?? slugify(input.name);
  try {
    return await database.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.name, slug },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, userId, role: "OWNER" },
      });
      await appendAuditEvent(tx, {
        tenantId: organization.id,
        actorId: userId,
        action: "organization.created",
        targetType: "organization",
        targetId: organization.id,
      });
      return { ...organization, role: "OWNER" as const };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError("CONFLICT");
    throw error;
  }
}
export async function requireMembership(
  userId: string,
  organizationId: string,
) {
  const membership = await findMembership(userId, organizationId);
  if (!membership) throw new AppError("NOT_FOUND");
  return membership;
}
export async function updateOrganization(
  userId: string,
  organizationId: string,
  input: { name?: string; slug?: string },
) {
  await requirePermission(userId, organizationId, "organization:update");
  try {
    return await database.$transaction(async (tx) => {
      const organization = await tx.organization.update({
        where: { id: organizationId },
        data: input,
        select: { id: true, name: true, slug: true },
      });
      await appendAuditEvent(tx, {
        tenantId: organizationId,
        actorId: userId,
        action: "organization.updated",
        targetType: "organization",
        targetId: organizationId,
        metadata: { changedFields: Object.keys(input).join(",") },
      });
      return organization;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError("CONFLICT");
    throw error;
  }
}
export async function deleteOrganization(
  userId: string,
  organizationId: string,
) {
  await requirePermission(userId, organizationId, "organization:delete");
  await database.$transaction(async (tx) => {
    await appendAuditEvent(tx, {
      tenantId: organizationId,
      actorId: userId,
      action: "organization.deleted",
      targetType: "organization",
      targetId: organizationId,
    });
    await tx.organization.delete({ where: { id: organizationId } });
  });
}
