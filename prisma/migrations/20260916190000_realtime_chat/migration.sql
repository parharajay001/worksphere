CREATE TYPE "ConversationKind" AS ENUM ('PROJECT', 'TEAM');
CREATE TABLE "Conversation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "organizationId" UUID NOT NULL,
  "kind" "ConversationKind" NOT NULL, "projectId" UUID, "teamId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Conversation_scope_check" CHECK (("kind" = 'PROJECT' AND "projectId" IS NOT NULL AND "teamId" IS NULL) OR ("kind" = 'TEAM' AND "teamId" IS NOT NULL AND "projectId" IS NULL))
);
CREATE TABLE "ChatMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "conversationId" UUID NOT NULL,
  "authorId" UUID NOT NULL, "body" VARCHAR(4000) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatMessage_body_nonempty" CHECK (length(btrim("body")) > 0)
);
CREATE TABLE "ConversationReadState" (
  "conversationId" UUID NOT NULL, "userId" UUID NOT NULL,
  "lastReadAt" TIMESTAMPTZ(3) NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationReadState_pkey" PRIMARY KEY ("conversationId", "userId")
);
CREATE TABLE "ChatAttachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "messageId" UUID NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL, "fileName" VARCHAR(255) NOT NULL,
  "contentType" VARCHAR(127) NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChatAttachment_size_check" CHECK ("sizeBytes" >= 0)
);
CREATE UNIQUE INDEX "Conversation_projectId_key" ON "Conversation"("projectId");
CREATE UNIQUE INDEX "Conversation_teamId_key" ON "Conversation"("teamId");
CREATE INDEX "Conversation_organizationId_updatedAt_idx" ON "Conversation"("organizationId", "updatedAt");
CREATE INDEX "ChatMessage_conversationId_createdAt_id_idx" ON "ChatMessage"("conversationId", "createdAt", "id");
CREATE INDEX "ChatMessage_authorId_idx" ON "ChatMessage"("authorId");
CREATE INDEX "ConversationReadState_userId_updatedAt_idx" ON "ConversationReadState"("userId", "updatedAt");
CREATE UNIQUE INDEX "ChatAttachment_storageKey_key" ON "ChatAttachment"("storageKey");
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConversationReadState" ADD CONSTRAINT "ConversationReadState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationReadState" ADD CONSTRAINT "ConversationReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
