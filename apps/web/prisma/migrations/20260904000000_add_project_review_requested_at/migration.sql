-- AlterTable
ALTER TABLE "ecowoods"."Project" ADD COLUMN "reviewRequestedAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "Project_reviewRequestedAt_idx" ON "ecowoods"."Project"("reviewRequestedAt");
