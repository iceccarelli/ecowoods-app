-- Durable order-confirmation email delivery state and refund/dispute fields on
-- PaymentCase (additive only): nine new NULLABLE columns, no defaults, no
-- backfill, no index, no enum change. No existing row, column, constraint or
-- index is altered or dropped. Existing Order.confirmationEmailSentAt values
-- keep meaning "sent", so deploying this sends nothing retroactively.

-- AlterTable
ALTER TABLE "ecowoods"."Order" ADD COLUMN     "confirmationEmailAttempts" INTEGER,
ADD COLUMN     "confirmationEmailLastError" VARCHAR(300),
ADD COLUMN     "confirmationEmailLeaseUntil" TIMESTAMPTZ,
ADD COLUMN     "confirmationEmailNextAttemptAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "ecowoods"."PaymentCase" ADD COLUMN     "disputeId" VARCHAR(100),
ADD COLUMN     "disputedAt" TIMESTAMPTZ,
ADD COLUMN     "refundFailedAt" TIMESTAMPTZ,
ADD COLUMN     "refundedAmount" DECIMAL(12,2),
ADD COLUMN     "refundedAt" TIMESTAMPTZ;
