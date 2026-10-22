-- Duplicate-payment cases and payment-confirmation email marker (additive only):
-- two new PaymentCaseKind values and one nullable Order column. The new enum
-- values are not used inside this migration. No existing row, column,
-- constraint or index is altered or dropped.

-- AlterEnum
ALTER TYPE "ecowoods"."PaymentCaseKind" ADD VALUE 'DUPLICATE_PAYMENT';

-- AlterEnum
ALTER TYPE "ecowoods"."PaymentCaseKind" ADD VALUE 'UNAPPLIED_PAYMENT';

-- AlterTable
ALTER TABLE "ecowoods"."Order" ADD COLUMN     "confirmationEmailSentAt" TIMESTAMPTZ;
