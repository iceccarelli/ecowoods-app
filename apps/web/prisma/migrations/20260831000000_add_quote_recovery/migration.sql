-- CreateTable
CREATE TABLE "ecowoods"."QuoteRecovery" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "service" TEXT,
    "city" TEXT,
    "consentedAt" TIMESTAMPTZ NOT NULL,
    "sentAt" TIMESTAMPTZ,
    "convertedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "QuoteRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteRecovery_email_idx" ON "ecowoods"."QuoteRecovery"("email");

-- CreateIndex
CREATE INDEX "QuoteRecovery_sentAt_idx" ON "ecowoods"."QuoteRecovery"("sentAt");

-- CreateIndex
CREATE INDEX "QuoteRecovery_createdAt_idx" ON "ecowoods"."QuoteRecovery"("createdAt");
