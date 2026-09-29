-- MEAS-01's join key was already load-bearing on QuoteRequest, Project and
-- FunnelEvent (migration 20260912000000_add_design_id) but never made it
-- onto RenovationAnalysis — the value existed only inside contextSnapshot's
-- JSONB blob, unindexed and unqueryable. Additive and nullable: every row
-- written before this migration gets NULL, which is the honest value (those
-- analyses were never attributed at the SQL level either).

-- AlterTable
ALTER TABLE "ecowoods"."RenovationAnalysis" ADD COLUMN "designId" VARCHAR(16);

-- CreateIndex
CREATE INDEX "RenovationAnalysis_designId_idx" ON "ecowoods"."RenovationAnalysis"("designId");
