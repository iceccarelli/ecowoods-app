-- MEAS-02 — the funnel ledger.
--
-- Additive: one enum and one table, no foreign keys, nothing existing touched.
-- Safe to `migrate deploy` against a live database with traffic on it.
--
-- No foreign keys is deliberate and matches the Floor Graph's reasoning:
-- deleting a quote or a project must never cascade into the record of how the
-- business performed. The links are indexed UUID columns joined in application
-- code.

-- CreateEnum
CREATE TYPE "ecowoods"."FunnelStage" AS ENUM ('LEAD_CAPTURED', 'APPOINTMENT_BOOKED', 'QUOTE_ISSUED', 'QUOTE_ACCEPTED', 'DEPOSIT_PAID', 'JOB_COMPLETED');

-- CreateTable
CREATE TABLE "ecowoods"."FunnelEvent" (
    "id" UUID NOT NULL,
    "stage" "ecowoods"."FunnelStage" NOT NULL,
    "designId" VARCHAR(16),
    "source" VARCHAR(120),
    "quoteId" UUID,
    "projectId" UUID,
    "amountCad" DECIMAL(12,2),
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_stage_occurredAt_idx" ON "ecowoods"."FunnelEvent"("stage", "occurredAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_designId_idx" ON "ecowoods"."FunnelEvent"("designId");

-- CreateIndex
CREATE INDEX "FunnelEvent_projectId_idx" ON "ecowoods"."FunnelEvent"("projectId");

-- CreateIndex
CREATE INDEX "FunnelEvent_quoteId_idx" ON "ecowoods"."FunnelEvent"("quoteId");
