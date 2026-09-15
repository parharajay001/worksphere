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
  name: string,
) {
  await requirePermission(userId, organizationId, "organization:update");
  return database.organization.update({
    where: { id: organizationId },
    data: { name },
    select: { id: true, name: true, slug: true },
  });
}
export async function deleteOrganization(
  userId: string,
  organizationId: string,
) {
  await requirePermission(userId, organizationId, "organization:delete");
  await database.organization.delete({ where: { id: organizationId } });
}
