import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63) || "team";
export async function createTeam(
  userId: string,
  organizationId: string,
  name: string,
) {
  await requirePermission(userId, organizationId, "members:manage");
  try {
    return await database.team.create({
      data: { organizationId, name, slug: slugify(name) },
      select: { id: true, name: true, slug: true, organizationId: true },
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
export async function listTeams(userId: string, organizationId: string) {
  await requirePermission(userId, organizationId, "organization:read");
  return database.team.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationId: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { projects: true } },
    },
  });
}
export async function updateTeam(userId: string, teamId: string, name: string) {
  const team = await database.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true },
  });
  if (!team) throw new AppError("NOT_FOUND");
  await requirePermission(userId, team.organizationId, "members:manage");
  try {
    return await database.team.update({
      where: { id: teamId },
      data: { name, slug: slugify(name) },
      select: { id: true, name: true, slug: true, organizationId: true },
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
export async function deleteTeam(userId: string, teamId: string) {
  const team = await database.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true },
  });
  if (!team) throw new AppError("NOT_FOUND");
  await requirePermission(userId, team.organizationId, "members:manage");
  await database.team.delete({ where: { id: teamId } });
}
export async function addTeamMember(
  userId: string,
  teamId: string,
  memberId: string,
) {
  const team = await database.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true },
  });
  if (!team) throw new AppError("NOT_FOUND");
  await requirePermission(userId, team.organizationId, "members:manage");
  const member = await database.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: team.organizationId,
        userId: memberId,
      },
    },
  });
  if (!member) throw new AppError("NOT_FOUND");
  try {
    return await database.teamMembership.create({
      data: { teamId, userId: memberId },
      select: { teamId: true, userId: true },
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
export async function removeTeamMember(
  userId: string,
  teamId: string,
  memberId: string,
) {
  const team = await database.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true },
  });
  if (!team) throw new AppError("NOT_FOUND");
  await requirePermission(userId, team.organizationId, "members:manage");
  const removed = await database.teamMembership.deleteMany({
    where: { teamId, userId: memberId },
  });
  if (!removed.count) throw new AppError("NOT_FOUND");
}
