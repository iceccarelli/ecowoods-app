-- CreateTable
CREATE TABLE "ecowoods"."PilotLead" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "role" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "squareFeet" INTEGER,
    "message" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "adminNotes" TEXT,
    "contactedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PilotLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PilotLead_email_idx" ON "ecowoods"."PilotLead"("email");

-- CreateIndex
CREATE INDEX "PilotLead_program_idx" ON "ecowoods"."PilotLead"("program");

-- CreateIndex
CREATE INDEX "PilotLead_status_idx" ON "ecowoods"."PilotLead"("status");

-- CreateIndex
CREATE INDEX "PilotLead_createdAt_idx" ON "ecowoods"."PilotLead"("createdAt");

