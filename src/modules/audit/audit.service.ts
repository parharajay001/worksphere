import "server-only";
import type { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import type { z } from "zod";
import type { auditQuerySchema } from "./audit.schemas.ts";

type AuditClient = Pick<Prisma.TransactionClient, "auditEvent">;

export function appendAuditEvent(
  client: AuditClient,
  input: {
    tenantId: string;
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, string | number | boolean>;
  },
) {
  return client.auditEvent.create({ data: input, select: { id: true } });
}

export async function listAuditEvents(
  userId: string,
  query: z.infer<typeof auditQuerySchema>,
) {
  await requirePermission(userId, query.organizationId, "members:manage");
  let before: { createdAt: Date; id: string } | undefined;
  if (query.cursor) {
    const cursor = await database.auditEvent.findFirst({
      where: { id: query.cursor, tenantId: query.organizationId },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new AppError("BAD_REQUEST");
    before = cursor;
  }
  const records = await database.auditEvent.findMany({
    where: {
      tenantId: query.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from
                ? { gte: new Date(`${query.from}T00:00:00.000Z`) }
                : {}),
              ...(query.to
                ? { lte: new Date(`${query.to}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
      ...(before
        ? {
            OR: [
              { createdAt: { lt: before.createdAt } },
              { createdAt: before.createdAt, id: { lt: before.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      metadata: true,
      createdAt: true,
      actorId: true,
    },
  });
  const hasMore = records.length > query.limit;
  const events = hasMore ? records.slice(0, query.limit) : records;
  const actorIds = [
    ...new Set(
      events.flatMap((event) => (event.actorId ? [event.actorId] : [])),
    ),
  ];
  const actors = actorIds.length
    ? await database.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.name]));
  return {
    events: events.map((event) => ({
      ...event,
      actorName: event.actorId
        ? (actorNames.get(event.actorId) ?? "Former member")
        : "System",
      createdAt: event.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (events.at(-1)?.id ?? null) : null,
  };
}
