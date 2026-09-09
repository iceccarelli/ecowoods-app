-- Floor Graph — the proprietary record of what was actually true about a floor.
--
-- Additive only. It creates five enums and seven tables and touches nothing
-- that already exists, so it is safe to `migrate deploy` against a live
-- database with traffic on it. There is deliberately no foreign key from any
-- of these tables to "QuoteRequest" or "Project": see the header comment in
-- schema.prisma. The links are UUID columns with indexes, joined in
-- application code, so that erasing a commercial record can never cascade
-- into the physical record of a floor that still exists in a house.

-- CreateEnum
CREATE TYPE "ecowoods"."ConsentPurpose" AS ENUM ('ASSESSMENT_PHOTOS', 'MODEL_TRAINING', 'BENCHMARK_CONTRIBUTION', 'FLOOR_RECORD');

-- CreateEnum
CREATE TYPE "ecowoods"."ConsentState" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ecowoods"."FloorGraphSource" AS ENUM ('PHOTO_TRIAGE', 'MEASURE_VISIT', 'JOB_EXECUTION', 'FRAMEWORK_ASSESS', 'IMPORT');

-- CreateEnum
CREATE TYPE "ecowoods"."AssessmentStatus" AS ENUM ('UNREVIEWED', 'TRIAGED', 'MEASURED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ecowoods"."PredictionKind" AS ENUM ('PRICE_CAD', 'LABOUR_HOURS', 'MATERIAL_SQFT', 'SCHEDULE_DAYS');

-- CreateTable
CREATE TABLE "ecowoods"."ConsentRecord" (
    "id" UUID NOT NULL,
    "purpose" "ecowoods"."ConsentPurpose" NOT NULL,
    "state" "ecowoods"."ConsentState" NOT NULL DEFAULT 'GRANTED',
    "subjectEmail" TEXT,
    "userId" UUID,
    "wording" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1',
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_subjectEmail_purpose_idx" ON "ecowoods"."ConsentRecord"("subjectEmail", "purpose");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_purpose_idx" ON "ecowoods"."ConsentRecord"("userId", "purpose");

-- CreateIndex
CREATE INDEX "ConsentRecord_grantedAt_idx" ON "ecowoods"."ConsentRecord"("grantedAt");

-- CreateTable
CREATE TABLE "ecowoods"."FloorRecord" (
    "id" UUID NOT NULL,
    "publicRef" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "postalPrefix" TEXT,
    "propertyType" TEXT,
    "storey" TEXT,
    "areaSqFt" INTEGER,
    "species" TEXT,
    "boardWidthMm" DECIMAL(6,2),
    "boardThickMm" DECIMAL(6,2),
    "pattern" TEXT,
    "finishSystem" TEXT,
    "substrate" TEXT,
    "installMethod" TEXT,
    "installedOn" DATE,
    "originQuoteRequestId" UUID,
    "originProjectId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "erasedAt" TIMESTAMPTZ,

    CONSTRAINT "FloorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FloorRecord_publicRef_key" ON "ecowoods"."FloorRecord"("publicRef");

-- CreateIndex
CREATE INDEX "FloorRecord_city_idx" ON "ecowoods"."FloorRecord"("city");

-- CreateIndex
CREATE INDEX "FloorRecord_species_idx" ON "ecowoods"."FloorRecord"("species");

-- CreateIndex
CREATE INDEX "FloorRecord_installedOn_idx" ON "ecowoods"."FloorRecord"("installedOn");

-- CreateIndex
CREATE INDEX "FloorRecord_originProjectId_idx" ON "ecowoods"."FloorRecord"("originProjectId");

-- CreateTable
CREATE TABLE "ecowoods"."FloorAssessment" (
    "id" UUID NOT NULL,
    "floorRecordId" UUID,
    "source" "ecowoods"."FloorGraphSource" NOT NULL,
    "status" "ecowoods"."AssessmentStatus" NOT NULL DEFAULT 'UNREVIEWED',
    "quoteRequestId" UUID,
    "projectId" UUID,
    "statedIntent" TEXT,
    "statedSqFt" INTEGER,
    "city" TEXT,
    "observedSpecies" TEXT,
    "observedFinish" TEXT,
    "observedSubstrate" TEXT,
    "observedDamage" JSONB,
    "moisturePctWood" DECIMAL(5,2),
    "moisturePctSubfloor" DECIMAL(5,2),
    "relativeHumidityPct" DECIMAL(5,2),
    "temperatureC" DECIMAL(5,2),
    "instrument" TEXT,
    "recommendation" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "erasedAt" TIMESTAMPTZ,

    CONSTRAINT "FloorAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FloorAssessment_floorRecordId_idx" ON "ecowoods"."FloorAssessment"("floorRecordId");

-- CreateIndex
CREATE INDEX "FloorAssessment_quoteRequestId_idx" ON "ecowoods"."FloorAssessment"("quoteRequestId");

-- CreateIndex
CREATE INDEX "FloorAssessment_source_status_idx" ON "ecowoods"."FloorAssessment"("source", "status");

-- CreateIndex
CREATE INDEX "FloorAssessment_createdAt_idx" ON "ecowoods"."FloorAssessment"("createdAt");

-- CreateTable
CREATE TABLE "ecowoods"."AssessmentPhoto" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "consentId" UUID NOT NULL,
    "observations" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erasedAt" TIMESTAMPTZ,

    CONSTRAINT "AssessmentPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssessmentPhoto_assessmentId_idx" ON "ecowoods"."AssessmentPhoto"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentPhoto_consentId_idx" ON "ecowoods"."AssessmentPhoto"("consentId");

-- CreateTable
CREATE TABLE "ecowoods"."FrameworkScoring" (
    "id" UUID NOT NULL,
    "frameworkVersion" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "criticalFailures" INTEGER NOT NULL DEFAULT 0,
    "region" TEXT,
    "scoredOn" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrameworkScoring_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrameworkScoring_frameworkVersion_scoredOn_idx" ON "ecowoods"."FrameworkScoring"("frameworkVersion", "scoredOn");

-- CreateIndex
CREATE INDEX "FrameworkScoring_region_idx" ON "ecowoods"."FrameworkScoring"("region");

-- CreateTable
CREATE TABLE "ecowoods"."JobOutcome" (
    "id" UUID NOT NULL,
    "floorRecordId" UUID,
    "projectId" UUID,
    "service" TEXT,
    "completedOn" DATE,
    "labourHours" DECIMAL(8,2),
    "machineHours" DECIMAL(8,2),
    "crewSize" INTEGER,
    "gritSequence" TEXT,
    "finishCoats" INTEGER,
    "cureHours" DECIMAL(6,2),
    "materialSqFt" DECIMAL(10,2),
    "wastePct" DECIMAL(5,2),
    "finishLitres" DECIMAL(8,2),
    "materialCostCad" DECIMAL(12,2),
    "labourCostCad" DECIMAL(12,2),
    "sellingPriceCad" DECIMAL(12,2),
    "scheduleDays" INTEGER,
    "defects" JSONB,
    "callbackAt" TIMESTAMPTZ,
    "warrantyClaimAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "JobOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOutcome_floorRecordId_idx" ON "ecowoods"."JobOutcome"("floorRecordId");

-- CreateIndex
CREATE INDEX "JobOutcome_projectId_idx" ON "ecowoods"."JobOutcome"("projectId");

-- CreateIndex
CREATE INDEX "JobOutcome_completedOn_idx" ON "ecowoods"."JobOutcome"("completedOn");

-- CreateTable
CREATE TABLE "ecowoods"."Prediction" (
    "id" UUID NOT NULL,
    "kind" "ecowoods"."PredictionKind" NOT NULL,
    "model" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "predictedValue" DECIMAL(14,4) NOT NULL,
    "predictedLow" DECIMAL(14,4),
    "predictedHigh" DECIMAL(14,4),
    "predictedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quoteRequestId" UUID,
    "projectId" UUID,
    "jobOutcomeId" UUID,
    "actualValue" DECIMAL(14,4),
    "closedAt" TIMESTAMPTZ,
    "error" DECIMAL(14,4),
    "absPctError" DECIMAL(8,4),

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prediction_kind_predictedAt_idx" ON "ecowoods"."Prediction"("kind", "predictedAt");

-- CreateIndex
CREATE INDEX "Prediction_quoteRequestId_idx" ON "ecowoods"."Prediction"("quoteRequestId");

-- CreateIndex
CREATE INDEX "Prediction_projectId_idx" ON "ecowoods"."Prediction"("projectId");

-- CreateIndex
CREATE INDEX "Prediction_closedAt_idx" ON "ecowoods"."Prediction"("closedAt");

-- AddForeignKey
ALTER TABLE "ecowoods"."FloorAssessment" ADD CONSTRAINT "FloorAssessment_floorRecordId_fkey" FOREIGN KEY ("floorRecordId") REFERENCES "ecowoods"."FloorRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."AssessmentPhoto" ADD CONSTRAINT "AssessmentPhoto_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ecowoods"."FloorAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."JobOutcome" ADD CONSTRAINT "JobOutcome_floorRecordId_fkey" FOREIGN KEY ("floorRecordId") REFERENCES "ecowoods"."FloorRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Prediction" ADD CONSTRAINT "Prediction_jobOutcomeId_fkey" FOREIGN KEY ("jobOutcomeId") REFERENCES "ecowoods"."JobOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
