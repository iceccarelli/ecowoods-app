-- AlterTable
ALTER TABLE "QuoteRequest"
ADD COLUMN "stripeCheckoutSessionId" TEXT,
ADD COLUMN "quoteIssuedAt" TIMESTAMPTZ,
ADD COLUMN "quoteLineItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "quoteNotes" TEXT,
ADD COLUMN "quotePdfUrl" TEXT,
ADD COLUMN "quoteTaxRate" NUMERIC(5,2),
ADD COLUMN "quoteValidUntil" TIMESTAMPTZ,
ADD COLUMN "quotedAmount" NUMERIC(12,2);
