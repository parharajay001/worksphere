import "server-only";
import { Prisma } from "../../generated/prisma/client.ts";
import { database } from "../../database/client.ts";
import { AppError } from "../../lib/api/errors.ts";
import { requirePermission } from "../authorization/guards.ts";
import { hasPermission } from "../authorization/permissions.ts";
import { publishRealtimeEvent } from "../../realtime/publisher.ts";
import type { z } from "zod";
import type {
  createConversationSchema,
  createMessageSchema,
  messageQuerySchema,
} from "./chat.schemas.ts";

type CreateConversation = z.infer<typeof createConversationSchema>;
type CreateMessage = z.infer<typeof createMessageSchema>;
type MessageQuery = z.infer<typeof messageQuerySchema>;

const messageSelect = {
  id: true,
  conversationId: true,
  body: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
  attachments: {
    select: { id: true, fileName: true, contentType: true, sizeBytes: true },
  },
} as const;

async function scopeAccess(userId: string, input: CreateConversation) {
  if (input.projectId) {
    const project = await database.project.findUnique({
      where: { id: input.projectId },
      select: { organizationId: true },
    });
    if (!project) throw new AppError("NOT_FOUND");
    await requirePermission(
      userId,
      project.organizationId,
      "organization:read",
    );
    return { kind: "PROJECT" as const, organizationId: project.organizationId };
  }
  const team = await database.team.findUnique({
    where: { id: input.teamId! },
    select: { organizationId: true },
  });
  if (!team) throw new AppError("NOT_FOUND");
  const membership = await requirePermission(
    userId,
    team.organizationId,
    "organization:read",
  );
  const teamMember = await database.teamMembership.findUnique({
    where: { teamId_userId: { teamId: input.teamId!, userId } },
    select: { id: true },
  });
  if (!teamMember && !hasPermission(membership.role, "projects:manage"))
    throw new AppError("NOT_FOUND");
  return { kind: "TEAM" as const, organizationId: team.organizationId };
}

export async function ensureConversation(
  userId: string,
  input: CreateConversation,
) {
  const scope = await scopeAccess(userId, input);
  const where = input.projectId
    ? { projectId: input.projectId }
    : { teamId: input.teamId! };
  const existing = await database.conversation.findFirst({ where });
  if (existing) return existing;
  try {
    return await database.conversation.create({
      data: {
        organizationId: scope.organizationId,
        kind: scope.kind,
        projectId: input.projectId,
        teamId: input.teamId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return database.conversation.findFirstOrThrow({ where });
    throw error;
  }
}

async function conversationAccess(userId: string, conversationId: string) {
  const conversation = await database.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      organizationId: true,
      kind: true,
      projectId: true,
      teamId: true,
    },
  });
  if (!conversation) throw new AppError("NOT_FOUND");
  await scopeAccess(userId, {
    projectId: conversation.projectId ?? undefined,
    teamId: conversation.teamId ?? undefined,
  });
  return conversation;
}

export async function listMessages(
  userId: string,
  conversationId: string,
  query: MessageQuery,
) {
  await conversationAccess(userId, conversationId);
  let before: { createdAt: Date; id: string } | undefined;
  if (query.cursor) {
    const cursor = await database.chatMessage.findFirst({
      where: { id: query.cursor, conversationId },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new AppError("BAD_REQUEST");
    before = cursor;
  }
  const records = await database.chatMessage.findMany({
    where: {
      conversationId,
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
    select: messageSelect,
  });
  const hasMore = records.length > query.limit;
  const page = hasMore ? records.slice(0, query.limit) : records;
  const readState = await database.conversationReadState.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { lastReadAt: true },
  });
  return {
    messages: page.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    lastReadAt: readState?.lastReadAt.toISOString() ?? null,
  };
}

export async function createMessage(
  userId: string,
  conversationId: string,
  input: CreateMessage,
) {
  const conversation = await conversationAccess(userId, conversationId);
  const message = await database.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: { conversationId, authorId: userId, body: input.body },
      select: messageSelect,
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    await tx.conversationReadState.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, lastReadAt: created.createdAt },
      update: { lastReadAt: created.createdAt },
    });
    return created;
  });
  await publishRealtimeEvent({
    name: "chat.message",
    target: {
      roomKind: conversation.kind === "PROJECT" ? "project" : "team",
      roomId: conversation.projectId ?? conversation.teamId!,
    },
    payload: { conversationId, messageId: message.id },
  });
  return { ...message, createdAt: message.createdAt.toISOString() };
}

export async function markConversationRead(
  userId: string,
  conversationId: string,
) {
  await conversationAccess(userId, conversationId);
  const lastReadAt = new Date();
  await database.conversationReadState.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    create: { conversationId, userId, lastReadAt },
    update: { lastReadAt },
  });
  return lastReadAt.toISOString();
}
