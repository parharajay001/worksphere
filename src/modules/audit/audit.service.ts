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
  });
  const hasMore = records.length > query.limit;
  const events = hasMore ? records.slice(0, query.limit) : records;
  return {
    events: events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (events.at(-1)?.id ?? null) : null,
  };
}
