-- Durable delivery state for the two cron emails (quote-recovery reminder and
-- post-job review request). Additive only: seven new NULLABLE columns, no
-- defaults, no backfill, no index, no enum change. No existing row, column,
-- constraint or index is altered or dropped.
--
-- Existing QuoteRecovery.sentAt values are untouched and keep meaning "sent":
-- the earlier code stamped sentAt BEFORE sending and never cleared it on a
-- failed send, so those rows cannot be told apart from genuinely sent ones.
-- Deploying this sends nothing retroactively.

-- AlterTable
ALTER TABLE "ecowoods"."QuoteRecovery" ADD COLUMN     "sendAttempts" INTEGER,
ADD COLUMN     "sendLastError" VARCHAR(300),
ADD COLUMN     "sendLeaseUntil" TIMESTAMPTZ,
ADD COLUMN     "sendNextAttemptAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "ecowoods"."Project" ADD COLUMN     "reviewEmailAttempts" INTEGER,
ADD COLUMN     "reviewEmailLastError" VARCHAR(300),
ADD COLUMN     "reviewEmailNextAttemptAt" TIMESTAMPTZ;
