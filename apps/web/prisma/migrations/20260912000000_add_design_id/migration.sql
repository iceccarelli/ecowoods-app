-- MEAS-01 — the design id, the join key between a visit and the revenue it produced.
--
-- Additive and nullable, so this is safe to `migrate deploy` against a live
-- database with traffic on it: no existing row changes, no write path breaks,
-- and every row written before this migration simply carries NULL — which is
-- the truthful value, because those leads were never attributable.
--
-- VarChar(16) against a 12-character value. The extra four are not for a longer
-- id; they are so that a future prefix or version marker does not require an
-- ALTER on a large table. The application validates the exact shape before any
-- write (lib/floor-studio/design-id.ts, isDesignId), so the column is a
-- backstop rather than the guard.
--
-- The indexes are the reason this patch exists. Without them the attribution
-- query is a sequential scan over every quote request the business has ever
-- taken, which is exactly the kind of query that gets written once, runs
-- slowly, and is then never run again.

-- AlterTable
ALTER TABLE "ecowoods"."QuoteRequest" ADD COLUMN "designId" VARCHAR(16);

-- AlterTable
ALTER TABLE "ecowoods"."Project" ADD COLUMN "designId" VARCHAR(16);

-- CreateIndex
CREATE INDEX "QuoteRequest_designId_idx" ON "ecowoods"."QuoteRequest"("designId");

-- CreateIndex
CREATE INDEX "Project_designId_idx" ON "ecowoods"."Project"("designId");
