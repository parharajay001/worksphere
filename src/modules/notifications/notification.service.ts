import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import type { z } from "zod";
import type { notificationQuerySchema } from "./notification.schemas.ts";
import { notificationKindForEvent } from "./mapping.ts";

type Query = z.infer<typeof notificationQuerySchema>;

const metadataKeys: Record<string, readonly string[]> = {
  mention: ["taskId", "commentId", "mentionedUserId"],
};

function safeMetadata(kind: string, metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return {};
  const source = metadata as Record<string, unknown>;
  const result: Record<string, string | number> = {};
  for (const key of metadataKeys[kind] ?? []) {
    const value = source[key];
    if (
      (typeof value === "string" && value.length <= 100) ||
      typeof value === "number"
    )
      result[key] = value;
  }
  return result;
}

const select = {
  id: true,
  kind: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  actor: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  commentId: true,
} as const;

export type NotificationItem = {
  id: string;
  kind: string;
  metadata: Record<string, string | number>;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  commentId: string | null;
};

export async function listNotifications(userId: string, query: Query) {
  let after: { createdAt: Date; id: string } | undefined;
  if (query.cursor) {
    const cursor = await database.notification.findFirst({
      where: { id: query.cursor, recipientId: userId },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new AppError("BAD_REQUEST");
    after = cursor;
  }
  const notifications = await database.notification.findMany({
    where: {
      recipientId: userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
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
  const hasMore = notifications.length > query.limit;
  const page = hasMore ? notifications.slice(0, query.limit) : notifications;
  const unreadCount = await database.notification.count({
    where: { recipientId: userId, readAt: null },
  });
  return {
    notifications: page.map((notification) => ({
      ...notification,
      kind: notification.kind.toLowerCase(),
      metadata: safeMetadata(
        notification.kind.toLowerCase(),
        notification.metadata,
      ),
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    })),
    unreadCount,
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function markNotificationRead(userId: string, id: string) {
  const result = await database.notification.updateMany({
    where: { id, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await database.notification.count({
      where: { id, recipientId: userId },
    });
    if (exists === 0) throw new AppError("NOT_FOUND");
  }
}

export async function markAllNotificationsRead(userId: string) {
  await database.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function createMentionNotification(
  client: Prisma.TransactionClient,
  data: {
    recipientId: string;
    actorId: string;
    organizationId: string;
    projectId: string;
    taskId: string;
    commentId: string;
  },
) {
  return client.notification.create({
    data: {
      ...data,
      kind: notificationKindForEvent("mention.created") ?? "MENTION",
      metadata: {
        taskId: data.taskId,
        commentId: data.commentId,
        mentionedUserId: data.recipientId,
      },
    },
    select: { id: true },
  });
}
