-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ecowoods";

-- CreateEnum
CREATE TYPE "ecowoods"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ecowoods"."QuoteStatus" AS ENUM ('PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ecowoods"."ProjectStatus" AS ENUM ('DRAFT', 'CONTRACT_SENT', 'SIGNED', 'DEPOSIT_PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ecowoods"."InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "ecowoods"."PaymentMethod" AS ENUM ('STRIPE', 'BANK_TRANSFER', 'PLAID', 'CASH');

-- CreateEnum
CREATE TYPE "ecowoods"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ecowoods"."InquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ecowoods"."InvoiceStage" AS ENUM ('DEPOSIT', 'MIDPOINT', 'FINAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ecowoods"."AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ecowoods"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "ecowoods"."UserRole" NOT NULL DEFAULT 'USER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."EmailVerificationToken" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Session" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL
);

-- CreateTable
CREATE TABLE "ecowoods"."QuoteRequest" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "province" TEXT,
    "address" TEXT,
    "species" JSONB,
    "squareFeet" INTEGER,
    "projectType" TEXT,
    "timeline" TEXT,
    "budgetRange" TEXT,
    "service" TEXT,
    "notes" TEXT,
    "attachments" JSONB,
    "status" "ecowoods"."QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "quotedAmount" DECIMAL(12,2),
    "quoteTaxRate" DECIMAL(5,2),
    "quoteLineItems" JSONB NOT NULL DEFAULT '[]',
    "quoteNotes" TEXT,
    "quoteValidUntil" TIMESTAMPTZ,
    "quoteIssuedAt" TIMESTAMPTZ,
    "quotePdfUrl" TEXT,
    "userId" UUID,
    "projectId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Project" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "species" JSONB,
    "squareFeet" INTEGER,
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    "status" "ecowoods"."ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "contractPdfUrl" TEXT,
    "signedContractPdfUrl" TEXT,
    "contractSignedAt" TIMESTAMPTZ,
    "depositPct" DECIMAL(5,2) DEFAULT 30.00,
    "midpointPct" DECIMAL(5,2) DEFAULT 40.00,
    "finalPct" DECIMAL(5,2) DEFAULT 30.00,
    "taxRate" DECIMAL(5,2) DEFAULT 13.00,
    "contractValue" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."ProjectNote" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Invoice" (
    "id" UUID NOT NULL,
    "number" TEXT,
    "projectId" UUID NOT NULL,
    "stage" "ecowoods"."InvoiceStage",
    "status" "ecowoods"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "surchargePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "dueDate" TIMESTAMPTZ,
    "issuedAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "pdfUrl" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Payment" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "userId" UUID,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "ecowoods"."PaymentMethod",
    "status" "ecowoods"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentIntentId" TEXT,
    "stripeCharged" BOOLEAN NOT NULL DEFAULT false,
    "bankReference" TEXT,
    "bankConfirmedAt" TIMESTAMPTZ,
    "bankConfirmedByNote" TEXT,
    "plaidTransactionId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Inquiry" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "ecowoods"."InquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."InquiryReply" (
    "id" UUID NOT NULL,
    "inquiryId" UUID NOT NULL,
    "fromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Settings" (
    "id" UUID NOT NULL,
    "defaultDepositPct" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "defaultMidpointPct" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "defaultFinalPct" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "companyName" TEXT,
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "companyNumberHst" TEXT,
    "companyLogoUrl" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiBankTransferInstructions" TEXT,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Appointment" (
    "id" UUID NOT NULL,
    "quoteRequestId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "ecowoods"."AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "ecowoods"."User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "ecowoods"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "ecowoods"."EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_token_idx" ON "ecowoods"."EmailVerificationToken"("token");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_idx" ON "ecowoods"."EmailVerificationToken"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "ecowoods"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "ecowoods"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "ecowoods"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "ecowoods"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_projectId_key" ON "ecowoods"."QuoteRequest"("projectId");

-- CreateIndex
CREATE INDEX "QuoteRequest_email_idx" ON "ecowoods"."QuoteRequest"("email");

-- CreateIndex
CREATE INDEX "QuoteRequest_status_idx" ON "ecowoods"."QuoteRequest"("status");

-- CreateIndex
CREATE INDEX "QuoteRequest_userId_idx" ON "ecowoods"."QuoteRequest"("userId");

-- CreateIndex
CREATE INDEX "Project_userId_idx" ON "ecowoods"."Project"("userId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "ecowoods"."Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "ecowoods"."Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "ecowoods"."Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "ecowoods"."Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_number_idx" ON "ecowoods"."Invoice"("number");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "ecowoods"."Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "ecowoods"."Payment"("status");

-- CreateIndex
CREATE INDEX "Inquiry_email_idx" ON "ecowoods"."Inquiry"("email");

-- CreateIndex
CREATE INDEX "Inquiry_status_idx" ON "ecowoods"."Inquiry"("status");

-- CreateIndex
CREATE INDEX "Inquiry_userId_idx" ON "ecowoods"."Inquiry"("userId");

-- CreateIndex
CREATE INDEX "Appointment_startsAt_idx" ON "ecowoods"."Appointment"("startsAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "ecowoods"."Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_quoteRequestId_idx" ON "ecowoods"."Appointment"("quoteRequestId");

-- AddForeignKey
ALTER TABLE "ecowoods"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."QuoteRequest" ADD CONSTRAINT "QuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."QuoteRequest" ADD CONSTRAINT "QuoteRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ecowoods"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ecowoods"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Invoice" ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ecowoods"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ecowoods"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Inquiry" ADD CONSTRAINT "Inquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."InquiryReply" ADD CONSTRAINT "InquiryReply_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "ecowoods"."Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."Appointment" ADD CONSTRAINT "Appointment_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "ecowoods"."QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

