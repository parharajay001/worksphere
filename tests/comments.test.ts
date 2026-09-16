import assert from "node:assert/strict";
import test from "node:test";
import {
  commentQuerySchema,
  createCommentSchema,
} from "../src/modules/comments/comment.schemas.ts";

test("comment schemas trim text and enforce bounded pagination", () => {
  assert.equal(
    createCommentSchema.parse({ body: "  useful context  " }).body,
    "useful context",
  );
  assert.equal(commentQuerySchema.parse({}).limit, 20);
  assert.deepEqual(commentQuerySchema.parse({ limit: "50" }), { limit: 50 });
  assert.equal(createCommentSchema.safeParse({ body: "   " }).success, false);
  assert.equal(
    createCommentSchema.safeParse({ body: "x", taskId: "injected" }).success,
    false,
  );
  assert.equal(commentQuerySchema.safeParse({ limit: "51" }).success, false);
  assert.equal(commentQuerySchema.safeParse({ limit: "1.5" }).success, false);
  assert.equal(
    commentQuerySchema.safeParse({ cursor: "not-a-uuid" }).success,
    false,
  );
});
