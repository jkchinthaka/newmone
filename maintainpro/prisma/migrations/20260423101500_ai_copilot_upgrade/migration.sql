-- CreateEnum
CREATE TYPE "CopilotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "CopilotConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL DEFAULT 'GENERAL',
    "mode" TEXT NOT NULL DEFAULT 'CHAT',
    "providerConversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "CopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL DEFAULT 'GENERAL',
    "mode" TEXT NOT NULL DEFAULT 'CHAT',
    "suggestedActions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotInteractionLog" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "query" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL DEFAULT 'GENERAL',
    "mode" TEXT NOT NULL DEFAULT 'CHAT',
    "contextSnapshot" JSONB,
    "fallbackCode" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'rapidapi-copilot',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotInteractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotConversation_userId_updatedAt_idx" ON "CopilotConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CopilotConversation_tenantId_updatedAt_idx" ON "CopilotConversation"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "CopilotMessage_conversationId_createdAt_idx" ON "CopilotMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotInteractionLog_userId_createdAt_idx" ON "CopilotInteractionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotInteractionLog_tenantId_createdAt_idx" ON "CopilotInteractionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotInteractionLog_focusArea_createdAt_idx" ON "CopilotInteractionLog"("focusArea", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotInteractionLog_mode_createdAt_idx" ON "CopilotInteractionLog"("mode", "createdAt");

-- AddForeignKey
ALTER TABLE "CopilotConversation" ADD CONSTRAINT "CopilotConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotInteractionLog" ADD CONSTRAINT "CopilotInteractionLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotInteractionLog" ADD CONSTRAINT "CopilotInteractionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
