-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "quoteIssuedAt" TIMESTAMP(3),
ADD COLUMN     "quoteLineItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "quoteNotes" TEXT,
ADD COLUMN     "quotePdfUrl" TEXT,
ADD COLUMN     "quoteTaxRate" DOUBLE PRECISION,
ADD COLUMN     "quoteValidUntil" TIMESTAMP(3),
ADD COLUMN     "quotedAmount" DOUBLE PRECISION;
