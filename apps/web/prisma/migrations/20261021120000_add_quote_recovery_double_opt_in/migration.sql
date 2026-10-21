-- Double opt-in for quote-recovery reminders (CASL): a row is only sendable
-- once the mailbox owner confirms. Existing rows stay unconfirmed and are
-- therefore never sent (their "consent" was typed by whoever filled the form).
ALTER TABLE "ecowoods"."QuoteRecovery"
  ADD COLUMN "confirmedAt" TIMESTAMPTZ,
  ADD COLUMN "confirmTokenHash" TEXT,
  ADD COLUMN "confirmSentAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "QuoteRecovery_confirmTokenHash_idx" ON "ecowoods"."QuoteRecovery"("confirmTokenHash");
