import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { hasPermission } from "../authorization/permissions.ts";
import { requirePermission } from "../authorization/guards.ts";
import { resolveMentions } from "./mentions.ts";
import { createMentionNotification } from "../notifications/notification.service.ts";
import type { z } from "zod";
import type {
  commentQuerySchema,
  createCommentSchema,
  updateCommentSchema,
} from "./comment.schemas.ts";

type CreateInput = z.infer<typeof createCommentSchema>;
type UpdateInput = z.infer<typeof updateCommentSchema>;
type Query = z.infer<typeof commentQuerySchema>;

const select = {
  id: true,
  taskId: true,
  authorId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

type CommentRecord = {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string; email: string };
};

function present(comment: CommentRecord) {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  };
}

async function taskContext(userId: string, taskId: string, write = false) {
  const task = await database.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, project: { select: { organizationId: true } } },
  });
  if (!task) throw new AppError("NOT_FOUND");
  const membership = await requirePermission(
    userId,
    task.project.organizationId,
    write ? "projects:manage" : "organization:read",
  );
  return { ...task, membership };
}

export async function listComments(
  userId: string,
  taskId: string,
  query: Query,
) {
  await taskContext(userId, taskId);
  let after: { createdAt: Date; id: string } | undefined;
  if (query.cursor) {
    const cursor = await database.comment.findUnique({
      where: { id: query.cursor },
      select: { taskId: true, createdAt: true, id: true },
    });
    if (!cursor || cursor.taskId !== taskId) throw new AppError("BAD_REQUEST");
    after = cursor;
  }
  const comments = await database.comment.findMany({
    where: {
      taskId,
      ...(after
        ? {
            OR: [
              { createdAt: { lt: after.createdAt } },
              { createdAt: after.createdAt, id: { lt: after.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select,
  });
  const hasMore = comments.length > query.limit;
  const page = hasMore ? comments.slice(0, query.limit) : comments;
  return {
    comments: page.map((comment) => present(comment)),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function createComment(
  userId: string,
  taskId: string,
  input: CreateInput,
) {
  const context = await taskContext(userId, taskId);
  const mentionedUsers = await resolveMentions(
    context.project.organizationId,
    input.body,
  );
  const result = await database.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { taskId, authorId: userId, body: input.body },
      select,
    });
    await tx.activityEvent.create({
      data: {
        projectId: context.projectId,
        actorId: userId,
        action: "comment.created",
        metadata: { taskId, commentId: comment.id },
      },
    });
    for (const user of mentionedUsers) {
      await tx.activityEvent.create({
        data: {
          projectId: context.projectId,
          actorId: userId,
          action: "mention.created",
          metadata: { taskId, commentId: comment.id, mentionedUserId: user.id },
        },
      });
      await createMentionNotification(tx, {
        recipientId: user.id,
        actorId: userId,
        organizationId: context.project.organizationId,
        projectId: context.projectId,
        taskId,
        commentId: comment.id,
      });
    }
    return present(comment);
  });
  return result;
}

async function commentContext(userId: string, id: string, write = false) {
  const comment = await database.comment.findUnique({
    where: { id },
    select: {
      ...select,
      task: {
        select: {
          projectId: true,
          project: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!comment) throw new AppError("NOT_FOUND");
  const membership = await requirePermission(
    userId,
    comment.task.project.organizationId,
    write ? "organization:read" : "organization:read",
  );
  return { comment, membership };
}

function canChange(
  userId: string,
  authorId: string,
  role: Parameters<typeof hasPermission>[0],
) {
  return authorId === userId || hasPermission(role, "projects:manage");
}

export async function updateComment(
  userId: string,
  id: string,
  input: UpdateInput,
) {
  const context = await commentContext(userId, id, true);
  if (!canChange(userId, context.comment.authorId, context.membership.role))
    throw new AppError("FORBIDDEN");
  const mentionedUsers = await resolveMentions(
    context.comment.task.project.organizationId,
    input.body,
  );
  try {
    const result = await database.$transaction(async (tx) => {
      const comment = await tx.comment.update({
        where: { id },
        data: { body: input.body },
        select,
      });
      await tx.activityEvent.create({
        data: {
          projectId: context.comment.task.projectId,
          actorId: userId,
          action: "comment.updated",
          metadata: { taskId: context.comment.taskId, commentId: id },
        },
      });
      for (const user of mentionedUsers) {
        await tx.activityEvent.create({
          data: {
            projectId: context.comment.task.projectId,
            actorId: userId,
            action: "mention.created",
            metadata: {
              taskId: context.comment.taskId,
              commentId: id,
              mentionedUserId: user.id,
            },
          },
        });
        await createMentionNotification(tx, {
          recipientId: user.id,
          actorId: userId,
          organizationId: context.comment.task.project.organizationId,
          projectId: context.comment.task.projectId,
          taskId: context.comment.taskId,
          commentId: id,
        });
      }
      return present(comment);
    });
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    )
      throw new AppError("NOT_FOUND");
    throw error;
  }
}

export async function deleteComment(userId: string, id: string) {
  const context = await commentContext(userId, id, true);
  if (!canChange(userId, context.comment.authorId, context.membership.role))
    throw new AppError("FORBIDDEN");
  await database.$transaction(async (tx) => {
    const deleted = await tx.comment.deleteMany({ where: { id } });
    if (deleted.count !== 1) throw new AppError("NOT_FOUND");
    await tx.activityEvent.create({
      data: {
        projectId: context.comment.task.projectId,
        actorId: userId,
        action: "comment.deleted",
        metadata: { taskId: context.comment.taskId, commentId: id },
      },
    });
  });
}
