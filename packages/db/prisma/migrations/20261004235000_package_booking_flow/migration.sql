-- CreateEnum
CREATE TYPE "PackagePriceMode" AS ENUM (
  'PER_PERSON',
  'PER_VEHICLE',
  'PER_GROUP',
  'FIXED'
);

-- CreateTable
CREATE TABLE "TourPackage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "body" JSONB NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "durationDays" INTEGER NOT NULL,
  "durationNights" INTEGER NOT NULL,
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

  CONSTRAINT "TourPackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TourPackage_durationDays_check" CHECK ("durationDays" > 0),
  CONSTRAINT "TourPackage_durationNights_check" CHECK ("durationNights" >= 0)
);

CREATE TABLE "PackageDestination" (
  "packageId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PackageDestination_pkey" PRIMARY KEY ("packageId", "destinationId")
);

CREATE TABLE "PackageItineraryDay" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "dayNumber" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "body" JSONB,
  CONSTRAINT "PackageItineraryDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackageItineraryDay_dayNumber_check" CHECK ("dayNumber" > 0)
);

CREATE TABLE "PackagePriceOption" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "mode" "PackagePriceMode" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "amountMinor" BIGINT NOT NULL,
  "vehicleClassId" TEXT,
  "minTravellers" INTEGER,
  "maxTravellers" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PackagePriceOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackagePriceOption_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PackagePriceOption_amount_check" CHECK ("amountMinor" >= 0),
  CONSTRAINT "PackagePriceOption_min_travellers_check" CHECK (
    "minTravellers" IS NULL OR "minTravellers" > 0
  ),
  CONSTRAINT "PackagePriceOption_max_travellers_check" CHECK (
    "maxTravellers" IS NULL OR "maxTravellers" > 0
  ),
  CONSTRAINT "PackagePriceOption_traveller_range_check" CHECK (
    "minTravellers" IS NULL
    OR "maxTravellers" IS NULL
    OR "minTravellers" <= "maxTravellers"
  ),
  CONSTRAINT "PackagePriceOption_vehicle_mode_check" CHECK (
    "mode" <> 'PER_VEHICLE' OR "vehicleClassId" IS NOT NULL
  )
);

CREATE TABLE "PackageQuote" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "priceOptionId" TEXT NOT NULL,
  "travellers" INTEGER NOT NULL,
  "vehicleCount" INTEGER,
  "quantity" INTEGER NOT NULL,
  "travelStartAt" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotalMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "taxMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL,
  "priceBreakdown" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PackageQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackageQuote_travellers_check" CHECK ("travellers" > 0),
  CONSTRAINT "PackageQuote_vehicle_count_check" CHECK (
    "vehicleCount" IS NULL OR "vehicleCount" > 0
  ),
  CONSTRAINT "PackageQuote_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "PackageQuote_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PackageQuote_money_check" CHECK (
    "subtotalMinor" >= 0
    AND "discountMinor" >= 0
    AND "taxMinor" >= 0
    AND "totalMinor" >= 0
    AND "discountMinor" <= "subtotalMinor" + "taxMinor"
    AND "totalMinor" = "subtotalMinor" - "discountMinor" + "taxMinor"
  ),
  CONSTRAINT "PackageQuote_expiry_check" CHECK ("createdAt" < "expiresAt")
);

CREATE TABLE "PackageBooking" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "quoteId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
  "packageId" TEXT NOT NULL,
  "priceOptionId" TEXT,
  "travellers" INTEGER NOT NULL,
  "vehicleCount" INTEGER,
  "travelStartAt" TIMESTAMP(3) NOT NULL,
  "customerUserId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "guestPhoneCiphertext" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotalMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "taxMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL,
  "packageSnapshot" JSONB NOT NULL,
  "priceSnapshot" JSONB NOT NULL,
  "policySnapshot" JSONB NOT NULL,
  "bookingPolicyVersionId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PackageBooking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackageBooking_travellers_check" CHECK ("travellers" > 0),
  CONSTRAINT "PackageBooking_vehicle_count_check" CHECK (
    "vehicleCount" IS NULL OR "vehicleCount" > 0
  ),
  CONSTRAINT "PackageBooking_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PackageBooking_money_check" CHECK (
    "subtotalMinor" >= 0
    AND "discountMinor" >= 0
    AND "taxMinor" >= 0
    AND "totalMinor" >= 0
    AND "discountMinor" <= "subtotalMinor" + "taxMinor"
    AND "totalMinor" = "subtotalMinor" - "discountMinor" + "taxMinor"
  ),
  CONSTRAINT "PackageBooking_customer_identity_check" CHECK (
    "customerUserId" IS NOT NULL
    OR (
      "guestName" IS NOT NULL
      AND length(trim("guestName")) > 0
      AND "guestEmail" IS NOT NULL
      AND length(trim("guestEmail")) > 0
    )
  )
);

CREATE TABLE "PackageBookingStatusHistory" (
  "id" BIGSERIAL NOT NULL,
  "bookingId" TEXT NOT NULL,
  "fromStatus" "BookingStatus",
  "toStatus" "BookingStatus" NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageBookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "TourPackage_slug_key" ON "TourPackage"("slug");
CREATE UNIQUE INDEX "PackageItineraryDay_packageId_dayNumber_key"
  ON "PackageItineraryDay"("packageId", "dayNumber");
CREATE UNIQUE INDEX "PackageBooking_reference_key" ON "PackageBooking"("reference");
CREATE UNIQUE INDEX "PackageBooking_quoteId_key" ON "PackageBooking"("quoteId");
CREATE UNIQUE INDEX "PackageBooking_idempotencyKey_key" ON "PackageBooking"("idempotencyKey");

-- Query indexes
CREATE INDEX "TourPackage_status_publishedAt_idx"
  ON "TourPackage"("status", "publishedAt");
CREATE INDEX "TourPackage_scheduledFor_idx" ON "TourPackage"("scheduledFor");
CREATE INDEX "PackageDestination_destinationId_idx" ON "PackageDestination"("destinationId");
CREATE INDEX "PackageItineraryDay_packageId_dayNumber_idx"
  ON "PackageItineraryDay"("packageId", "dayNumber");
CREATE INDEX "PackagePriceOption_packageId_isActive_sortOrder_idx"
  ON "PackagePriceOption"("packageId", "isActive", "sortOrder");
CREATE INDEX "PackagePriceOption_vehicleClassId_idx"
  ON "PackagePriceOption"("vehicleClassId");
CREATE INDEX "PackageQuote_packageId_travelStartAt_idx"
  ON "PackageQuote"("packageId", "travelStartAt");
CREATE INDEX "PackageQuote_priceOptionId_idx" ON "PackageQuote"("priceOptionId");
CREATE INDEX "PackageQuote_expiresAt_idx" ON "PackageQuote"("expiresAt");
CREATE INDEX "PackageBooking_status_travelStartAt_idx"
  ON "PackageBooking"("status", "travelStartAt");
CREATE INDEX "PackageBooking_packageId_travelStartAt_idx"
  ON "PackageBooking"("packageId", "travelStartAt");
CREATE INDEX "PackageBooking_customerUserId_createdAt_idx"
  ON "PackageBooking"("customerUserId", "createdAt");
CREATE INDEX "PackageBooking_bookingPolicyVersionId_idx"
  ON "PackageBooking"("bookingPolicyVersionId");
CREATE INDEX "PackageBookingStatusHistory_bookingId_createdAt_idx"
  ON "PackageBookingStatusHistory"("bookingId", "createdAt");
CREATE INDEX "PackageBookingStatusHistory_actorUserId_createdAt_idx"
  ON "PackageBookingStatusHistory"("actorUserId", "createdAt");

-- Foreign keys
ALTER TABLE "TourPackage"
  ADD CONSTRAINT "TourPackage_heroMediaId_fkey"
  FOREIGN KEY ("heroMediaId") REFERENCES "MediaAsset"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageDestination"
  ADD CONSTRAINT "PackageDestination_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageDestination"
  ADD CONSTRAINT "PackageDestination_destinationId_fkey"
  FOREIGN KEY ("destinationId") REFERENCES "Destination"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageItineraryDay"
  ADD CONSTRAINT "PackageItineraryDay_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackagePriceOption"
  ADD CONSTRAINT "PackagePriceOption_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackagePriceOption"
  ADD CONSTRAINT "PackagePriceOption_vehicleClassId_fkey"
  FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageQuote"
  ADD CONSTRAINT "PackageQuote_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageQuote"
  ADD CONSTRAINT "PackageQuote_priceOptionId_fkey"
  FOREIGN KEY ("priceOptionId") REFERENCES "PackagePriceOption"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "PackageQuote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_priceOptionId_fkey"
  FOREIGN KEY ("priceOptionId") REFERENCES "PackagePriceOption"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_bookingPolicyVersionId_fkey"
  FOREIGN KEY ("bookingPolicyVersionId") REFERENCES "BookingPolicyVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageBookingStatusHistory"
  ADD CONSTRAINT "PackageBookingStatusHistory_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "PackageBooking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageBookingStatusHistory"
  ADD CONSTRAINT "PackageBookingStatusHistory_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
