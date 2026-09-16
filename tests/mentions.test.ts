import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMentionTokens } from "../src/modules/comments/mentions.ts";

test("extracts unique mention tokens without treating email domains as mentions", () => {
  assert.deepEqual(
    extractMentionTokens("Hi @Alice, @alice and ( @member-name )."),
    ["alice", "member-name"],
  );
  assert.deepEqual(extractMentionTokens("email alice@example.com"), []);
});

test("limits the number of mentions in one comment", () => {
  const body = Array.from({ length: 26 }, (_, index) => `@member${index}`).join(
    " ",
  );
  assert.throws(() => extractMentionTokens(body), { code: "BAD_REQUEST" });
});
