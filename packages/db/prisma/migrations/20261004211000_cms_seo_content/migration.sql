-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM (
  'DRAFT',
  'REVIEW',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "DestinationKind" AS ENUM (
  'CITY',
  'TEMPLE',
  'NATURE',
  'HERITAGE',
  'REGION'
);

-- CreateEnum
CREATE TYPE "FaqScope" AS ENUM (
  'GENERAL',
  'BOOKING',
  'PRICING',
  'CANCELLATION',
  'VEHICLES',
  'PACKAGES'
);

-- CreateTable
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "bucket" TEXT,
  "objectKey" TEXT NOT NULL,
  "publicUrl" TEXT,
  "mimeType" TEXT NOT NULL,
  "byteSize" BIGINT,
  "width" INTEGER,
  "height" INTEGER,
  "altText" TEXT,
  "caption" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsPage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "body" JSONB NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3),
  "heroMediaId" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "canonicalUrl" TEXT,
  "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
  "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Destination" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "DestinationKind" NOT NULL,
  "summary" TEXT,
  "body" JSONB NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3),
  "heroMediaId" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "canonicalUrl" TEXT,
  "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
  "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TempleProfile" (
  "id" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "templeName" TEXT NOT NULL,
  "deity" TEXT,
  "darshanNotes" TEXT,
  "dressCode" TEXT,
  "openingHours" JSONB,
  "nearbyPlaces" JSONB,
  "practicalNotes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TempleProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogCategory" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT,
  "body" JSONB NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "categoryId" TEXT,
  "heroMediaId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3),
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "canonicalUrl" TEXT,
  "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
  "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Faq" (
  "id" TEXT NOT NULL,
  "scope" "FaqScope" NOT NULL DEFAULT 'GENERAL',
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentRevision" (
  "id" BIGSERIAL NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoRedirect" (
  "id" TEXT NOT NULL,
  "sourcePath" TEXT NOT NULL,
  "destinationPath" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL DEFAULT 301,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeoRedirect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SeoRedirect_statusCode_check" CHECK ("statusCode" IN (301, 302)),
  CONSTRAINT "SeoRedirect_no_self_redirect_check" CHECK ("sourcePath" <> "destinationPath")
);

-- Unique indexes
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");
CREATE UNIQUE INDEX "TempleProfile_destinationId_key" ON "TempleProfile"("destinationId");
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE UNIQUE INDEX "ContentRevision_entityType_entityId_version_key"
  ON "ContentRevision"("entityType", "entityId", "version");
CREATE UNIQUE INDEX "SeoRedirect_sourcePath_key" ON "SeoRedirect"("sourcePath");

-- Query indexes
CREATE INDEX "MediaAsset_mimeType_idx" ON "MediaAsset"("mimeType");
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");
CREATE INDEX "CmsPage_status_publishedAt_idx" ON "CmsPage"("status", "publishedAt");
CREATE INDEX "CmsPage_scheduledFor_idx" ON "CmsPage"("scheduledFor");
CREATE INDEX "Destination_kind_status_publishedAt_idx" ON "Destination"("kind", "status", "publishedAt");
CREATE INDEX "Destination_isFeatured_status_idx" ON "Destination"("isFeatured", "status");
CREATE INDEX "Destination_scheduledFor_idx" ON "Destination"("scheduledFor");
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");
CREATE INDEX "BlogPost_categoryId_status_idx" ON "BlogPost"("categoryId", "status");
CREATE INDEX "BlogPost_scheduledFor_idx" ON "BlogPost"("scheduledFor");
CREATE INDEX "Faq_scope_status_sortOrder_idx" ON "Faq"("scope", "status", "sortOrder");
CREATE INDEX "Faq_scheduledFor_idx" ON "Faq"("scheduledFor");
CREATE INDEX "ContentRevision_entityType_entityId_createdAt_idx"
  ON "ContentRevision"("entityType", "entityId", "createdAt");
CREATE INDEX "SeoRedirect_isActive_idx" ON "SeoRedirect"("isActive");

-- Foreign keys
ALTER TABLE "CmsPage"
  ADD CONSTRAINT "CmsPage_heroMediaId_fkey"
  FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Destination"
  ADD CONSTRAINT "Destination_heroMediaId_fkey"
  FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TempleProfile"
  ADD CONSTRAINT "TempleProfile_destinationId_fkey"
  FOREIGN KEY ("destinationId") REFERENCES "Destination"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlogPost"
  ADD CONSTRAINT "BlogPost_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BlogPost"
  ADD CONSTRAINT "BlogPost_heroMediaId_fkey"
  FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
