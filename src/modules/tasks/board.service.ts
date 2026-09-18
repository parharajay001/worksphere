import "server-only";
import type { z } from "zod";
import { database } from "../../database/client.ts";
import type { Prisma } from "../../generated/prisma/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import { advanceBoard } from "./board.repository.ts";
import { reorderTasks, type Board } from "./board.ts";
import { publishRealtimeEvent } from "../../realtime/publisher.ts";
import type { moveTaskSchema } from "./board.schemas.ts";
import { createAppNotification } from "../notifications/notification.service.ts";

async function authorize(userId: string, projectId: string, write: boolean) {
  const project = await database.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  await requirePermission(
    userId,
    project.organizationId,
    write ? "projects:manage" : "organization:read",
  );
  return project.organizationId;
}

async function snapshot(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<Board> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { boardRevision: true },
  });
  if (!project) throw new AppError("NOT_FOUND");
  const tasks = await tx.task.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      position: true,
      dueDate: true,
      assignee: { select: { id: true, name: true, email: true } },
    },
  });
  return {
    revision: project.boardRevision,
    tasks: tasks.map((task) => ({
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
    })),
  };
}

export async function getBoard(userId: string, projectId: string) {
  await authorize(userId, projectId, false);
  return database.$transaction((tx) => snapshot(tx, projectId), {
    isolationLevel: "RepeatableRead",
  });
}

export async function moveTask(
  userId: string,
  projectId: string,
  input: z.infer<typeof moveTaskSchema>,
) {
  const organizationId = await authorize(userId, projectId, true);
  const board = await database.$transaction(async (tx) => {
    await advanceBoard(tx, projectId, input.revision);
    const tasks = await tx.task.findMany({
      where: { projectId },
      select: { id: true, status: true, position: true, assigneeId: true },
    });
    const task = tasks.find((item) => item.id === input.taskId);
    if (!task) throw new AppError("NOT_FOUND");
    const count = tasks.filter(
      (item) => item.status === input.status && item.id !== input.taskId,
    ).length;
    if (input.index > count) throw new AppError("BAD_REQUEST");
    const reordered = reorderTasks(
      tasks,
      input.taskId,
      input.status,
      input.index,
    );
    const previous = new Map(tasks.map((item) => [item.id, item]));
    for (const item of reordered) {
      const old = previous.get(item.id)!;
      if (old.status !== item.status || old.position !== item.position) {
        await tx.task.update({
          where: { id: item.id },
          data: { status: item.status, position: item.position },
        });
      }
    }
    await tx.activityEvent.create({
      data: {
        projectId,
        actorId: userId,
        action: "task.moved",
        metadata: {
          taskId: task.id,
          fromStatus: task.status,
          toStatus: input.status,
          position: input.index,
        },
      },
    });
    if (task.status !== input.status) {
      await tx.activityEvent.create({
        data: {
          projectId,
          actorId: userId,
          action: "task.status_changed",
          metadata: {
            taskId: task.id,
            fromStatus: task.status,
            toStatus: input.status,
          },
        },
      });
      if (task.assigneeId && task.assigneeId !== userId)
        await createAppNotification(tx, {
          kind: "STATUS_CHANGE",
          recipientId: task.assigneeId,
          actorId: userId,
          organizationId,
          projectId,
          taskId: task.id,
          metadata: {
            taskId: task.id,
            fromStatus: task.status,
            toStatus: input.status,
          },
        });
    }
    return snapshot(tx, projectId);
  });
  await publishRealtimeEvent({
    name: "task.changed",
    target: { projectId },
    payload: {
      projectId,
      taskId: input.taskId,
      action: "moved",
    },
  });
  return board;
}
