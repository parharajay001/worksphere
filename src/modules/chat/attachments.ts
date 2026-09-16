import "server-only";

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
