import "server-only";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import type { z } from "zod";
import type { activityQuerySchema } from "./activity.schemas.ts";

type Query = z.infer<typeof activityQuerySchema>;
type Scope = { organizationId?: string; projectId?: string };
type RawMetadata = Record<string, unknown> | null;

const metadataKeys: Record<string, readonly string[]> = {
  "task.created": ["taskId"],
  "task.updated": ["taskId"],
  "task.moved": ["taskId", "fromStatus", "toStatus", "position"],
  "comment.created": ["taskId", "commentId"],
  "comment.updated": ["taskId", "commentId"],
  "comment.deleted": ["taskId", "commentId"],
  "mention.created": ["taskId", "commentId", "mentionedUserId"],
};

function safeMetadata(action: string, metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return {};
  const source = metadata as RawMetadata;
  const result: Record<string, string | number> = {};
  for (const key of metadataKeys[action] ?? []) {
    const value = source?.[key];
    if (
      (typeof value === "string" && value.length <= 100) ||
      typeof value === "number"
    )
      result[key] = value;
  }
  return result;
}

async function authorize(userId: string, scope: Scope) {
  if (scope.projectId) {
    const project = await database.project.findUnique({
      where: { id: scope.projectId },
      select: { organizationId: true },
    });
    if (!project) throw new AppError("NOT_FOUND");
    await requirePermission(
      userId,
      project.organizationId,
      "organization:read",
    );
    return project.organizationId;
  }
  if (!scope.organizationId) throw new AppError("BAD_REQUEST");
  await requirePermission(userId, scope.organizationId, "organization:read");
  return scope.organizationId;
}

export type ActivityItem = {
  id: string;
  action: string;
  metadata: Record<string, string | number>;
  createdAt: string;
  actor: { id: string; name: string };
  project: { id: string; name: string };
};

export async function listActivity(userId: string, scope: Scope, query: Query) {
  const organizationId = await authorize(userId, scope);
  let after: { createdAt: Date; id: string } | undefined;
  if (query.cursor) {
    const cursor = await database.activityEvent.findUnique({
      where: { id: query.cursor },
      select: {
        id: true,
        createdAt: true,
        projectId: true,
        project: { select: { organizationId: true } },
      },
    });
    if (
      !cursor ||
      cursor.project.organizationId !== organizationId ||
      (scope.projectId && cursor.projectId !== scope.projectId)
    )
      throw new AppError("BAD_REQUEST");
    after = cursor;
  }
  const events = await database.activityEvent.findMany({
    where: {
      ...(scope.projectId
        ? { projectId: scope.projectId }
        : { project: { organizationId } }),
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
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  const hasMore = events.length > query.limit;
  const page = hasMore ? events.slice(0, query.limit) : events;
  return {
    activities: page.map((event) => ({
      id: event.id,
      action: event.action,
      metadata: safeMetadata(event.action, event.metadata),
      createdAt: event.createdAt.toISOString(),
      actor: event.actor,
      project: event.project,
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}
