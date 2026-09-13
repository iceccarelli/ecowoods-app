-- SALE-01 — the Floor Studio design code, as a column instead of prose.
--
-- Additive and nullable: safe to `migrate deploy` against a live database with
-- traffic on it. Rows written before this carry NULL, and the admin screen
-- falls back to extracting the code from `notes` for them, so no backfill is
-- needed and no history is lost.
--
-- VarChar(400) matches the bound leadSchema already enforces on the field.

-- AlterTable
ALTER TABLE "ecowoods"."QuoteRequest" ADD COLUMN "designCode" VARCHAR(400);
