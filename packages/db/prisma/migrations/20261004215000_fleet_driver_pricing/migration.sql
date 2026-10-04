-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE',
  'RETIRED'
);

CREATE TYPE "DriverStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'ON_LEAVE',
  'SUSPENDED'
);

CREATE TYPE "PricingRuleStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'INACTIVE',
  'ARCHIVED'
);

CREATE TYPE "TripType" AS ENUM (
  'ONE_WAY',
  'ROUND_TRIP',
  'MULTI_CITY'
);

CREATE TYPE "PricingBasis" AS ENUM (
  'PER_KM',
  'FIXED',
  'QUOTE_ONLY'
);

-- CreateTable
CREATE TABLE "VehicleClass" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultSeats" INTEGER NOT NULL,
  "defaultLuggage" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleClass_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleClass_defaultSeats_check" CHECK ("defaultSeats" > 0),
  CONSTRAINT "VehicleClass_defaultLuggage_check" CHECK ("defaultLuggage" IS NULL OR "defaultLuggage" >= 0)
);

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "vehicleClassId" TEXT NOT NULL,
  "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
  "seats" INTEGER NOT NULL,
  "luggage" INTEGER,
  "airConditioned" BOOLEAN NOT NULL DEFAULT true,
  "features" JSONB,
  "description" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vehicle_seats_check" CHECK ("seats" > 0),
  CONSTRAINT "Vehicle_luggage_check" CHECK ("luggage" IS NULL OR "luggage" >= 0)
);

CREATE TABLE "VehicleMedia" (
  "vehicleId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "VehicleMedia_pkey" PRIMARY KEY ("vehicleId", "mediaId")
);

CREATE TABLE "Driver" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
  "phoneCiphertext" TEXT,
  "phoneLast4" TEXT,
  "licenseNumberCiphertext" TEXT,
  "licenseExpiry" TIMESTAMP(3),
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Driver_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Driver_phoneLast4_check" CHECK (
    "phoneLast4" IS NULL OR "phoneLast4" ~ '^[0-9]{4}$'
  )
);

CREATE TABLE "DriverVehicleClass" (
  "driverId" TEXT NOT NULL,
  "vehicleClassId" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverVehicleClass_pkey" PRIMARY KEY ("driverId", "vehicleClassId")
);

CREATE TABLE "VehicleAvailabilityBlock" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleAvailabilityBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleAvailabilityBlock_range_check" CHECK ("startsAt" < "endsAt")
);

CREATE TABLE "DriverAvailabilityBlock" (
  "id" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverAvailabilityBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverAvailabilityBlock_range_check" CHECK ("startsAt" < "endsAt")
);

CREATE TABLE "PricingRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "vehicleClassId" TEXT NOT NULL,
  "tripType" "TripType" NOT NULL,
  "basis" "PricingBasis" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "baseAmountMinor" BIGINT,
  "perKmMinor" BIGINT,
  "minimumDistanceKm" INTEGER,
  "driverAllowancePerDayMinor" BIGINT,
  "nightAllowanceMinor" BIGINT,
  "originKey" TEXT,
  "destinationKey" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" "PricingRuleStatus" NOT NULL DEFAULT 'DRAFT',
  "activeFrom" TIMESTAMP(3),
  "activeTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PricingRule_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PricingRule_amounts_check" CHECK (
    ("baseAmountMinor" IS NULL OR "baseAmountMinor" >= 0)
    AND ("perKmMinor" IS NULL OR "perKmMinor" >= 0)
    AND ("minimumDistanceKm" IS NULL OR "minimumDistanceKm" >= 0)
    AND ("driverAllowancePerDayMinor" IS NULL OR "driverAllowancePerDayMinor" >= 0)
    AND ("nightAllowanceMinor" IS NULL OR "nightAllowanceMinor" >= 0)
  ),
  CONSTRAINT "PricingRule_basis_check" CHECK (
    ("basis" = 'PER_KM' AND "perKmMinor" IS NOT NULL)
    OR ("basis" = 'FIXED' AND "baseAmountMinor" IS NOT NULL)
    OR ("basis" = 'QUOTE_ONLY')
  ),
  CONSTRAINT "PricingRule_active_range_check" CHECK (
    "activeFrom" IS NULL OR "activeTo" IS NULL OR "activeFrom" < "activeTo"
  )
);

-- Unique indexes
CREATE UNIQUE INDEX "VehicleClass_slug_key" ON "VehicleClass"("slug");
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");
CREATE UNIQUE INDEX "Vehicle_registrationNumber_key" ON "Vehicle"("registrationNumber");

-- Query indexes
CREATE INDEX "VehicleClass_isActive_sortOrder_idx" ON "VehicleClass"("isActive", "sortOrder");
CREATE INDEX "Vehicle_vehicleClassId_status_idx" ON "Vehicle"("vehicleClassId", "status");
CREATE INDEX "Vehicle_isFeatured_status_idx" ON "Vehicle"("isFeatured", "status");
CREATE INDEX "VehicleMedia_mediaId_idx" ON "VehicleMedia"("mediaId");
CREATE INDEX "VehicleMedia_vehicleId_isPrimary_idx" ON "VehicleMedia"("vehicleId", "isPrimary");
CREATE INDEX "Driver_status_idx" ON "Driver"("status");
CREATE INDEX "Driver_licenseExpiry_idx" ON "Driver"("licenseExpiry");
CREATE INDEX "DriverVehicleClass_vehicleClassId_idx" ON "DriverVehicleClass"("vehicleClassId");
CREATE INDEX "VehicleAvailabilityBlock_vehicleId_startsAt_endsAt_idx"
  ON "VehicleAvailabilityBlock"("vehicleId", "startsAt", "endsAt");
CREATE INDEX "DriverAvailabilityBlock_driverId_startsAt_endsAt_idx"
  ON "DriverAvailabilityBlock"("driverId", "startsAt", "endsAt");
CREATE INDEX "PricingRule_vehicleClassId_tripType_status_priority_idx"
  ON "PricingRule"("vehicleClassId", "tripType", "status", "priority");
CREATE INDEX "PricingRule_originKey_destinationKey_idx"
  ON "PricingRule"("originKey", "destinationKey");
CREATE INDEX "PricingRule_activeFrom_activeTo_idx"
  ON "PricingRule"("activeFrom", "activeTo");

-- Foreign keys
ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_vehicleClassId_fkey"
  FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VehicleMedia"
  ADD CONSTRAINT "VehicleMedia_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleMedia"
  ADD CONSTRAINT "VehicleMedia_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriverVehicleClass"
  ADD CONSTRAINT "DriverVehicleClass_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriverVehicleClass"
  ADD CONSTRAINT "DriverVehicleClass_vehicleClassId_fkey"
  FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleAvailabilityBlock"
  ADD CONSTRAINT "VehicleAvailabilityBlock_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriverAvailabilityBlock"
  ADD CONSTRAINT "DriverAvailabilityBlock_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingRule"
  ADD CONSTRAINT "PricingRule_vehicleClassId_fkey"
  FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
