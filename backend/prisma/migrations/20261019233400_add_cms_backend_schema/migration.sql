-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'ACTIVE', 'RETIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "ImportRunType" AS ENUM ('BASELINE_CMS', 'EXCEL_RECONCILIATION');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('PREVIEWED', 'APPLYING', 'APPLIED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportClassification" AS ENUM ('BASELINE_RECORD', 'CONFIRMED_MATCH', 'POSSIBLE_MATCH', 'NEW_CANDIDATE', 'CONFLICT', 'NEEDS_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ImportDecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "Oem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceData" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "oemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceData" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "applications" TEXT,
    "externalLink" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceImagePath" TEXT,
    "sourceData" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsDocument" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsDocument_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SeoEntry" (
    "id" TEXT NOT NULL,
    "routeKey" TEXT NOT NULL,
    "oemId" TEXT,
    "categoryId" TEXT,
    "productId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "canonicalUrl" TEXT,
    "socialMetadata" JSONB,
    "structuredData" JSONB,
    "sourceData" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "sourcePath" TEXT,
    "r2Key" TEXT,
    "publicUrl" TEXT,
    "mimeType" TEXT,
    "byteSize" BIGINT,
    "sha256" CHAR(64),
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "productId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("productId","mediaAssetId")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'EDITOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "csrfTokenHash" CHAR(64) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "type" "ImportRunType" NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'PREVIEWED',
    "sourceFingerprint" TEXT NOT NULL,
    "startedById" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceRow" INTEGER,
    "cmsEntityType" TEXT,
    "cmsEntityId" TEXT,
    "classification" "ImportClassification" NOT NULL,
    "decisionStatus" "ImportDecisionStatus" NOT NULL DEFAULT 'PENDING',
    "currentData" JSONB,
    "proposedData" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Oem_visible_sortOrder_id_idx" ON "Oem"("visible", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Category_oemId_visible_sortOrder_id_idx" ON "Category"("oemId", "visible", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Product_categoryId_visible_sortOrder_id_idx" ON "Product"("categoryId", "visible", "sortOrder", "id");

-- CreateIndex
CREATE INDEX "Product_visible_sortOrder_id_idx" ON "Product"("visible", "sortOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SeoEntry_routeKey_key" ON "SeoEntry"("routeKey");

-- CreateIndex
CREATE UNIQUE INDEX "SeoEntry_oemId_key" ON "SeoEntry"("oemId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoEntry_categoryId_key" ON "SeoEntry"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoEntry_productId_key" ON "SeoEntry"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_r2Key_key" ON "MediaAsset"("r2Key");

-- CreateIndex
CREATE INDEX "MediaAsset_status_sha256_idx" ON "MediaAsset"("status", "sha256");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_sortOrder_idx" ON "ProductMedia"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductMedia_mediaAssetId_idx" ON "ProductMedia"("mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_absoluteExpiresAt_idx" ON "AdminSession"("adminUserId", "absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_absoluteExpiresAt_idx" ON "AdminSession"("absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_lastSeenAt_idx" ON "AdminSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_adminUserId_createdAt_idx" ON "AuditEvent"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRun_type_status_createdAt_idx" ON "ImportRun"("type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportItem_importRunId_decisionStatus_idx" ON "ImportItem"("importRunId", "decisionStatus");

-- CreateIndex
CREATE INDEX "ImportItem_cmsEntityType_cmsEntityId_idx" ON "ImportItem"("cmsEntityType", "cmsEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportItem_importRunId_sourceKey_key" ON "ImportItem"("importRunId", "sourceKey");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_oemId_fkey" FOREIGN KEY ("oemId") REFERENCES "Oem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoEntry" ADD CONSTRAINT "SeoEntry_oemId_fkey" FOREIGN KEY ("oemId") REFERENCES "Oem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoEntry" ADD CONSTRAINT "SeoEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoEntry" ADD CONSTRAINT "SeoEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce at most one catalog target; zero targets represents site-wide SEO.
ALTER TABLE "SeoEntry"
ADD CONSTRAINT "SeoEntry_at_most_one_target_check"
CHECK (num_nonnulls("oemId", "categoryId", "productId") <= 1);

-- Allow at most one primary image for each product; zero is valid.
CREATE UNIQUE INDEX "ProductMedia_one_primary_per_product_idx"
ON "ProductMedia" ("productId")
WHERE "isPrimary" = TRUE;
