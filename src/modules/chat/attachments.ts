import "server-only";
import { z } from "zod";

export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
] as const;

export const chatAttachmentInputSchema = z.strictObject({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (value) =>
        !/[\x00-\x1f\x7f]/.test(value) &&
        !value.includes("/") &&
        !value.includes("\\") &&
        value !== "." &&
        value !== "..",
    ),
  contentType: z.enum(CHAT_ATTACHMENT_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_CHAT_ATTACHMENT_BYTES),
});

export type StoredChatAttachment = {
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

// Future object-storage providers implement this boundary. Message APIs do not
// accept client-authored storage keys, so unattached uploads cannot be forged.
export type ChatAttachmentStore = {
  createUpload(input: {
    userId: string;
    conversationId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ uploadUrl: string; storageKey: string }>;
};
