-- Payment reconciliation (additive only): PaymentCase (durable admin work item
-- for payment discrepancies), StripeWebhookEvent (refund/dispute events already
-- applied), OrderStatus.REFUNDED and Order.refundedAmount (default 0).
-- No existing row, column or constraint is altered or dropped.

-- CreateEnum
CREATE TYPE "ecowoods"."PaymentCaseKind" AS ENUM ('LATE_PAYMENT_VOID_INVOICE', 'REFUND_NEEDS_REVIEW', 'CREDIT_REVERSAL_RECOMMENDED', 'DISPUTE_OPENED');

-- CreateEnum
CREATE TYPE "ecowoods"."PaymentCaseStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ecowoods"."PaymentCaseResolution" AS ENUM ('REFUNDED_MANUALLY', 'INVOICE_REISSUED', 'APPLIED_AS_CREDIT', 'CREDITS_ADJUSTED_SEPARATELY', 'DISPUTE_RESPONDED', 'NO_ACTION_REQUIRED', 'OTHER');

-- AlterEnum
ALTER TYPE "ecowoods"."OrderStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "ecowoods"."Order" ADD COLUMN     "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ecowoods"."PaymentCase" (
    "id" UUID NOT NULL,
    "kind" "ecowoods"."PaymentCaseKind" NOT NULL,
    "status" "ecowoods"."PaymentCaseStatus" NOT NULL DEFAULT 'OPEN',
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeEventId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'cad',
    "invoiceId" UUID,
    "orderId" UUID,
    "paymentId" UUID,
    "userId" UUID,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "resolution" "ecowoods"."PaymentCaseResolution",
    "resolutionNote" TEXT,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."StripeWebhookEvent" (
    "id" UUID NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "objectId" TEXT,
    "outcome" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCase_idempotencyKey_key" ON "ecowoods"."PaymentCase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentCase_status_createdAt_idx" ON "ecowoods"."PaymentCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentCase_invoiceId_idx" ON "ecowoods"."PaymentCase"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentCase_orderId_idx" ON "ecowoods"."PaymentCase"("orderId");

-- CreateIndex
CREATE INDEX "PaymentCase_stripePaymentIntentId_idx" ON "ecowoods"."PaymentCase"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key" ON "ecowoods"."StripeWebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_type_createdAt_idx" ON "ecowoods"."StripeWebhookEvent"("type", "createdAt");

