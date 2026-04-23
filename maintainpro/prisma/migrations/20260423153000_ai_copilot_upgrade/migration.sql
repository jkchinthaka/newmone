-- CreateTable
CREATE TABLE "CopilotConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL DEFAULT 'GENERAL',
    "mode" TEXT NOT NULL DEFAULT 'CHAT',
    "providerConversationId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL DEFAULT 'GENERAL',
    "mode" TEXT NOT NULL DEFAULT 'CHAT',
    "content" TEXT NOT NULL,
    "actions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotExchangeLog" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "userId" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL DEFAULT 'GENERAL',
    "mode" TEXT NOT NULL DEFAULT 'CHAT',
    "query" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'fallback',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotExchangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopilotConversation_userId_lastMessageAt_idx" ON "CopilotConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "CopilotMessage_conversationId_createdAt_idx" ON "CopilotMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotMessage_userId_createdAt_idx" ON "CopilotMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotExchangeLog_userId_createdAt_idx" ON "CopilotExchangeLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotExchangeLog_focusArea_createdAt_idx" ON "CopilotExchangeLog"("focusArea", "createdAt");

-- CreateIndex
CREATE INDEX "CopilotExchangeLog_createdAt_idx" ON "CopilotExchangeLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CopilotConversation" ADD CONSTRAINT "CopilotConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotExchangeLog" ADD CONSTRAINT "CopilotExchangeLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CopilotConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotExchangeLog" ADD CONSTRAINT "CopilotExchangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
