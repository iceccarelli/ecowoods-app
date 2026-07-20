-- CreateEnum
CREATE TYPE "ecowoods"."ProductCategory" AS ENUM ('MATERIAL', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "ecowoods"."ProductUnit" AS ENUM ('SQFT', 'EACH');

-- CreateEnum
CREATE TYPE "ecowoods"."OrderStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ecowoods"."Product" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ecowoods"."ProductCategory" NOT NULL,
    "unit" "ecowoods"."ProductUnit" NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "minQuantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "species" TEXT,
    "format" TEXT,
    "janka" INTEGER,
    "imageUrl" TEXT,
    "description" TEXT,
    "options" JSONB NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."Order" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "ecowoods"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecowoods"."OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "productName" TEXT NOT NULL,
    "unit" "ecowoods"."ProductUnit" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "selectedOptions" JSONB NOT NULL DEFAULT '[]',
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "ecowoods"."Product"("slug");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "ecowoods"."Product"("category");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "ecowoods"."Product"("active");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "ecowoods"."Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "ecowoods"."Order"("status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "ecowoods"."OrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "ecowoods"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "ecowoods"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ecowoods"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ecowoods"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ecowoods"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

