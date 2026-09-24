-- CreateEnum
CREATE TYPE "ecowoods"."CreditTransactionType" AS ENUM ('GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUST');

-- CreateEnum
CREATE TYPE "ecowoods"."RenovationAnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ecowoods"."CreditWallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."CreditTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ecowoods"."CreditTransactionType" NOT NULL,
    "credits" INTEGER NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "orderId" UUID,
    "analysisId" UUID,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."RenovationAnalysis" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "status" "ecowoods"."RenovationAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "creditsCharged" INTEGER NOT NULL,
    "contextSnapshot" JSONB NOT NULL,
    "result" JSONB,
    "failureReason" TEXT,
    "requestIdempotencyKey" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,

    CONSTRAINT "RenovationAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "ecowoods"."CreditWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "ecowoods"."CreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditTransaction_walletId_idx" ON "ecowoods"."CreditTransaction"("walletId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "ecowoods"."CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_orderId_idx" ON "ecowoods"."CreditTransaction"("orderId");

-- CreateIndex
CREATE INDEX "CreditTransaction_analysisId_idx" ON "ecowoods"."CreditTransaction"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "RenovationAnalysis_requestIdempotencyKey_key" ON "ecowoods"."RenovationAnalysis"("requestIdempotencyKey");

-- CreateIndex
CREATE INDEX "RenovationAnalysis_userId_idx" ON "ecowoods"."RenovationAnalysis"("userId");

-- CreateIndex
CREATE INDEX "RenovationAnalysis_status_idx" ON "ecowoods"."RenovationAnalysis"("status");

-- AddForeignKey
ALTER TABLE "ecowoods"."CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ecowoods"."CreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."RenovationAnalysis" ADD CONSTRAINT "RenovationAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."RenovationAnalysis" ADD CONSTRAINT "RenovationAnalysis_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ecowoods"."CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
