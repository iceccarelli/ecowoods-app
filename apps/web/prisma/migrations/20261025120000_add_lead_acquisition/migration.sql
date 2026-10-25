-- First-touch acquisition for leads, in a NEW table. Additive only: no existing
-- table, column, constraint or index is touched, no backfill, no data change.
--
-- It is a separate table so the application can be deployed before or after
-- this migration with no effect on leads: all reads and writes of it catch
-- their own failure (lib/lead-acquisition.ts), and a lead without a row is
-- reported as "not captured". Existing leads keep their notes untouched.

-- CreateTable
CREATE TABLE "ecowoods"."LeadAcquisition" (
    "quoteId" UUID NOT NULL,
    "channel" VARCHAR(24) NOT NULL,
    "landing" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAcquisition_pkey" PRIMARY KEY ("quoteId")
);

-- CreateIndex
CREATE INDEX "LeadAcquisition_createdAt_idx" ON "ecowoods"."LeadAcquisition"("createdAt");
