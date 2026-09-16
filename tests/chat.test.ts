import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createConversationSchema,
  createMessageSchema,
  messageQuerySchema,
} from "../src/modules/chat/chat.schemas.ts";
import {
  realtimeEventSchema,
  typingEventSchema,
} from "../src/realtime/contracts.ts";

const projectId = "30000000-0000-4000-8000-000000000001";
const conversationId = "50000000-0000-4000-8000-000000000001";
const messageId = "60000000-0000-4000-8000-000000000001";

test("conversation scopes require exactly one project or team", () => {
  assert.equal(createConversationSchema.safeParse({ projectId }).success, true);
  assert.equal(createConversationSchema.safeParse({}).success, false);
  assert.equal(
    createConversationSchema.safeParse({ projectId, teamId: projectId })
      .success,
    false,
  );
});

test("message input and history pagination are bounded", () => {
  assert.equal(createMessageSchema.parse({ body: "  hello  " }).body, "hello");
  assert.equal(createMessageSchema.safeParse({ body: "" }).success, false);
  assert.equal(
    createMessageSchema.safeParse({ body: "x".repeat(4001) }).success,
    false,
  );
  assert.equal(messageQuerySchema.parse({ limit: "50" }).limit, 50);
  assert.equal(messageQuerySchema.safeParse({ limit: "51" }).success, false);
});

test("chat and typing socket contracts reject excess data", () => {
  assert.equal(
    realtimeEventSchema.safeParse({
      name: "chat.message",
      target: { roomKind: "project", roomId: projectId },
      payload: { conversationId, messageId },
    }).success,
    true,
  );
  assert.equal(
    typingEventSchema.safeParse({
      target: { kind: "project", id: projectId },
      active: true,
      userId: messageId,
    }).success,
    false,
  );
});
