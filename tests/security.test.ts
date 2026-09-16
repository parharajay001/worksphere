import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_ATTACHMENT_TYPES,
  MAX_CHAT_ATTACHMENT_BYTES,
  chatAttachmentInputSchema,
} from "../src/modules/chat/attachments.ts";

test("attachment metadata accepts bounded allowlisted files", () => {
  assert.deepEqual(
    chatAttachmentInputSchema.parse({
      fileName: "architecture.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    }),
    {
      fileName: "architecture.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    },
  );
  assert.ok(CHAT_ATTACHMENT_TYPES.length > 0);
});

test("attachment metadata rejects traversal, unsupported types, and oversized files", () => {
  for (const input of [
    {
      fileName: "../secret.txt",
      contentType: "text/plain",
      sizeBytes: 10,
    },
    {
      fileName: "malware.exe",
      contentType: "application/octet-stream",
      sizeBytes: 10,
    },
    {
      fileName: "large.pdf",
      contentType: "application/pdf",
      sizeBytes: MAX_CHAT_ATTACHMENT_BYTES + 1,
    },
  ]) {
    assert.equal(chatAttachmentInputSchema.safeParse(input).success, false);
  }
});
