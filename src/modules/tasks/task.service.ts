import "server-only";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import { publishRealtimeEvent } from "../../realtime/publisher.ts";
import { advanceBoard, nextPosition } from "./board.repository.ts";
import { invalidateAnalytics } from "../analytics/analytics.service.ts";
import type { z } from "zod";
import type {
  createTaskSchema,
  taskFilterSchema,
  updateTaskSchema,
} from "./task.schemas.ts";
type Create = z.infer<typeof createTaskSchema>;
type Update = z.infer<typeof updateTaskSchema>;
type Filter = z.infer<typeof taskFilterSchema>;
const select = {
  id: true,
  projectId: true,
  reporterId: true,
  assigneeId: true,
  title: true,
  description: true,
  status: true,
  position: true,
  priority: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
} as const;
async function projectFor(
  userId: string,
  projectId: string,
  permission: "organization:read" | "projects:manage",
) {
  const project = await database.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(userId, project.organizationId, permission);
  return project;
}
async function validateAssignee(
  organizationId: string,
  assigneeId?: string | null,
) {
  if (
    assigneeId &&
    !(await database.membership.findUnique({
      where: { organizationId_userId: { organizationId, userId: assigneeId } },
    }))
  )
    throw new AppError("NOT_FOUND");
}
export async function listTasks(userId: string, filter: Filter) {
  await projectFor(userId, filter.projectId, "organization:read");
  return database.task.findMany({
    where: {
      projectId: filter.projectId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.priority ? { priority: filter.priority } : {}),
      ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select,
  });
}
export async function getTask(userId: string, id: string) {
  const task = await database.task.findUnique({
    where: { id },
    select: { ...select, project: { select: { organizationId: true } } },
  });
  if (!task) throw new AppError("NOT_FOUND");
  await requirePermission(
    userId,
    task.project.organizationId,
    "organization:read",
  );
  return task;
}
export async function createTask(userId: string, input: Create) {
  const project = await projectFor(userId, input.projectId, "projects:manage");
  await validateAssignee(project.organizationId, input.assigneeId);
  const task = await database.$transaction(async (tx) => {
    await advanceBoard(tx, input.projectId);
    const status = input.status ?? "TODO";
    const created = await tx.task.create({
      data: {
        projectId: input.projectId,
        reporterId: userId,
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        priority: input.priority,
        status,
        position: await nextPosition(tx, input.projectId, status),
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
      select,
    });
    await tx.activityEvent.create({
      data: {
        projectId: input.projectId,
        actorId: userId,
        action: "task.created",
        metadata: { taskId: created.id },
      },
    });
    return created;
  });
  await publishRealtimeEvent({
    name: "task.changed",
    target: { projectId: input.projectId },
    payload: {
      projectId: input.projectId,
      taskId: task.id,
      action: "created",
    },
  });
  await invalidateAnalytics(project.organizationId);
  return task;
}
export async function updateTask(userId: string, id: string, input: Update) {
  const task = await database.task.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!task) throw new AppError("NOT_FOUND");
  const project = await projectFor(userId, task.projectId, "projects:manage");
  await validateAssignee(project.organizationId, input.assigneeId);
  const updated = await database.$transaction(async (tx) => {
    await advanceBoard(tx, task.projectId);
    const current = await tx.task.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new AppError("NOT_FOUND");
    const result = await tx.task.update({
      where: { id },
      data: {
        ...input,
        ...(input.status && input.status !== current.status
          ? { position: await nextPosition(tx, task.projectId, input.status) }
          : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
          : {}),
      },
      select,
    });
    await tx.activityEvent.create({
      data: {
        projectId: task.projectId,
        actorId: userId,
        action: "task.updated",
        metadata: { taskId: id },
      },
    });
    return result;
  });
  await publishRealtimeEvent({
    name: "task.changed",
    target: { projectId: task.projectId },
    payload: { projectId: task.projectId, taskId: id, action: "updated" },
  });
  await invalidateAnalytics(project.organizationId);
  return updated;
}
export async function deleteTask(userId: string, id: string) {
  const task = await database.task.findUnique({
    where: { id },
    select: { projectId: true },
  });
  if (!task) throw new AppError("NOT_FOUND");
  const project = await projectFor(userId, task.projectId, "projects:manage");
  await database.$transaction(async (tx) => {
    await advanceBoard(tx, task.projectId);
    const deleted = await tx.task.deleteMany({
      where: { id, projectId: task.projectId },
    });
    if (deleted.count !== 1) throw new AppError("NOT_FOUND");
  });
  await publishRealtimeEvent({
    name: "task.changed",
    target: { projectId: task.projectId },
    payload: { projectId: task.projectId, taskId: id, action: "deleted" },
  });
  await invalidateAnalytics(project.organizationId);
}
