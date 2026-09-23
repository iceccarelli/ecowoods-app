-- CreateEnum
CREATE TYPE "ecowoods"."CreditTransactionType" AS ENUM ('PURCHASE', 'PROMOTIONAL_GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'REFUND');

-- CreateEnum
CREATE TYPE "ecowoods"."RenovationAnalysisStatus" AS ENUM ('RESERVED', 'RUNNING', 'COMPLETED', 'FAILED', 'RELEASED');

-- CreateTable
CREATE TABLE "ecowoods"."CreditWallet" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."CreditTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "type" "ecowoods"."CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "orderId" UUID,
    "analysisId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."RenovationAnalysis" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "designId" VARCHAR(16) NOT NULL,
    "status" "ecowoods"."RenovationAnalysisStatus" NOT NULL DEFAULT 'RESERVED',
    "creditCost" INTEGER NOT NULL,
    "reservationTxId" UUID,
    "settlementTxId" UUID,
    "engineVersion" TEXT NOT NULL,
    "resultJson" JSONB,
    "failureReason" TEXT,
    "generatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RenovationAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "ecowoods"."CreditWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_idempotencyKey_key" ON "ecowoods"."CreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CreditTransaction_walletId_idx" ON "ecowoods"."CreditTransaction"("walletId");

-- CreateIndex
CREATE INDEX "CreditTransaction_analysisId_idx" ON "ecowoods"."CreditTransaction"("analysisId");

-- CreateIndex
CREATE INDEX "CreditTransaction_orderId_idx" ON "ecowoods"."CreditTransaction"("orderId");

-- CreateIndex
CREATE INDEX "RenovationAnalysis_userId_idx" ON "ecowoods"."RenovationAnalysis"("userId");

-- CreateIndex
CREATE INDEX "RenovationAnalysis_designId_idx" ON "ecowoods"."RenovationAnalysis"("designId");

-- CreateIndex
CREATE INDEX "RenovationAnalysis_status_idx" ON "ecowoods"."RenovationAnalysis"("status");

-- AddForeignKey
ALTER TABLE "ecowoods"."CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ecowoods"."CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."RenovationAnalysis" ADD CONSTRAINT "RenovationAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."RenovationAnalysis" ADD CONSTRAINT "RenovationAnalysis_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ecowoods"."CreditWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
