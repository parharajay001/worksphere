import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import {
  invalidateCache,
  getCachedJson,
  projectListKey,
  PROJECT_LIST_TTL_SECONDS,
  setCachedJson,
  type CacheState,
} from "../../cache/cache.ts";
import { invalidateAnalytics } from "../analytics/analytics.service.ts";
import type { z } from "zod";
import type {
  createProjectSchema,
  updateProjectSchema,
} from "./project.schemas.ts";
import { assertProjectAllowance } from "../billing/billing.service.ts";
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63) || "project";
const select = {
  id: true,
  organizationId: true,
  teamId: true,
  ownerId: true,
  name: true,
  slug: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  team: { select: { id: true, name: true, slug: true } },
  owner: { select: { id: true, name: true, email: true } },
} as const;
type CreateInput = z.infer<typeof createProjectSchema>;
type UpdateInput = z.infer<typeof updateProjectSchema>;
export async function listProjects(userId: string, organizationId: string) {
  return (await listProjectsWithCache(userId, organizationId)).projects;
}

async function queryProjects(organizationId: string) {
  return database.project.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    select,
  });
}

type ProjectList = Awaited<ReturnType<typeof queryProjects>>;

function reviveProjectList(value: ProjectList) {
  return value.map((project) => ({
    ...project,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  }));
}

export async function listProjectsWithCache(
  userId: string,
  organizationId: string,
) {
  await requirePermission(userId, organizationId, "organization:read");
  const key = projectListKey(organizationId);
  const cached = await getCachedJson<ProjectList>(key);
  if (cached.state === "hit")
    return {
      projects: reviveProjectList(cached.value),
      cache: "hit" as CacheState,
    };
  const projects = await queryProjects(organizationId);
  const stored = await setCachedJson(key, projects, PROJECT_LIST_TTL_SECONDS);
  return {
    projects,
    cache: stored ? ("miss" as CacheState) : ("unavailable" as CacheState),
  };
}

export function invalidateProjectList(organizationId: string) {
  return Promise.all([
    invalidateCache(projectListKey(organizationId)),
    invalidateAnalytics(organizationId),
  ]);
}
export async function getProject(userId: string, id: string) {
  const project = await database.project.findUnique({ where: { id }, select });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(userId, project.organizationId, "organization:read");
  return project;
}
export async function createProject(userId: string, input: CreateInput) {
  await requirePermission(userId, input.organizationId, "projects:manage");
  if (input.teamId) {
    const team = await database.team.findFirst({
      where: { id: input.teamId, organizationId: input.organizationId },
    });
    if (!team) throw new AppError("NOT_FOUND");
  }
  const ownerId = input.ownerId ?? userId;
  if (
    !(await database.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: ownerId,
        },
      },
    }))
  )
    throw new AppError("NOT_FOUND");
  try {
    const project = await database.$transaction(async (tx) => {
      await assertProjectAllowance(tx, input.organizationId);
      const created = await tx.project.create({
        data: {
          organizationId: input.organizationId,
          teamId: input.teamId,
          ownerId,
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
          status: input.status,
        },
        select,
      });
      await tx.activityEvent.create({
        data: {
          projectId: created.id,
          actorId: userId,
          action: "project.created",
        },
      });
      return created;
    });
    await invalidateProjectList(input.organizationId);
    return project;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new AppError("CONFLICT");
    throw error;
  }
}
export async function updateProject(
  userId: string,
  id: string,
  input: UpdateInput,
) {
  const project = await database.project.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(userId, project.organizationId, "projects:manage");
  if (input.teamId) {
    const team = await database.team.findFirst({
      where: { id: input.teamId, organizationId: project.organizationId },
    });
    if (!team) throw new AppError("NOT_FOUND");
  }
  if (
    input.ownerId &&
    !(await database.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId: input.ownerId,
        },
      },
    }))
  )
    throw new AppError("NOT_FOUND");
  const updated = await database.project.update({
    where: { id },
    data: input,
    select,
  });
  await database.activityEvent.create({
    data: {
      projectId: id,
      actorId: userId,
      action: "project.updated",
      metadata: input,
    },
  });
  await invalidateProjectList(project.organizationId);
  return updated;
}
export async function deleteProject(userId: string, id: string) {
  const project = await database.project.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(userId, project.organizationId, "projects:manage");
  await database.project.delete({ where: { id } });
  await invalidateProjectList(project.organizationId);
}
export async function addProjectMember(
  userId: string,
  projectId: string,
  memberId: string,
) {
  const project = await database.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(userId, project.organizationId, "projects:manage");
  if (
    !(await database.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId: memberId,
        },
      },
    }))
  )
    throw new AppError("NOT_FOUND");
  try {
    return await database.projectMember.create({
      data: { projectId, userId: memberId },
      select: { projectId: true, userId: true },
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

export async function listProjectMembers(userId: string, projectId: string) {
  const project = await database.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(userId, project.organizationId, "organization:read");
  return database.projectMember.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}
