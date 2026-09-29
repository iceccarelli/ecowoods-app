-- Ask Francisco's durable transcript. One row per designId (the same
-- MEAS-01 join key QuoteRequest/Project/FunnelEvent/RenovationAnalysis
-- already use), userId nullable because a visitor can talk to Francisco
-- before signing in. Project Decision State itself stays exactly where it
-- already lived (localStorage, keyed by designId) — this table only makes
-- the conversation transcript reload-safe.

-- CreateTable
CREATE TABLE "ecowoods"."AssistantConversation" (
    "id" UUID NOT NULL,
    "designId" VARCHAR(16) NOT NULL,
    "userId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."AssistantMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "blocks" JSONB,
    "attachments" JSONB,
    "model" VARCHAR(80),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversation_designId_key" ON "ecowoods"."AssistantConversation"("designId");

-- CreateIndex
CREATE INDEX "AssistantConversation_userId_idx" ON "ecowoods"."AssistantConversation"("userId");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_createdAt_idx" ON "ecowoods"."AssistantMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ecowoods"."AssistantConversation" ADD CONSTRAINT "AssistantConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ecowoods"."AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
