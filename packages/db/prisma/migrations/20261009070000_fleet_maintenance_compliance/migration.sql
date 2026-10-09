CREATE TYPE "VehicleMaintenanceStatus" AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "VehicleDocumentType" AS ENUM (
  'REGISTRATION',
  'INSURANCE',
  'POLLUTION_CERTIFICATE',
  'PERMIT',
  'FITNESS_CERTIFICATE',
  'TAX',
  'OTHER'
);

CREATE TABLE "VehicleMaintenanceRecord" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "availabilityBlockId" TEXT,
  "status" "VehicleMaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "category" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "odometerKm" INTEGER,
  "costMinor" BIGINT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "vendor" TEXT,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleMaintenanceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleMaintenanceRecord_window_check"
    CHECK ("startsAt" < "endsAt"),
  CONSTRAINT "VehicleMaintenanceRecord_category_check"
    CHECK (char_length(trim("category")) BETWEEN 2 AND 80),
  CONSTRAINT "VehicleMaintenanceRecord_summary_check"
    CHECK (char_length(trim("summary")) BETWEEN 2 AND 200),
  CONSTRAINT "VehicleMaintenanceRecord_odometer_check"
    CHECK ("odometerKm" IS NULL OR "odometerKm" >= 0),
  CONSTRAINT "VehicleMaintenanceRecord_cost_check"
    CHECK ("costMinor" IS NULL OR "costMinor" >= 0),
  CONSTRAINT "VehicleMaintenanceRecord_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "VehicleMaintenanceRecord_completion_check"
    CHECK (
      ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
      OR
      ("status" <> 'COMPLETED' AND "completedAt" IS NULL)
    )
);

CREATE UNIQUE INDEX "VehicleMaintenanceRecord_availabilityBlockId_key"
  ON "VehicleMaintenanceRecord"("availabilityBlockId");
CREATE INDEX "VehicleMaintenanceRecord_vehicleId_startsAt_endsAt_idx"
  ON "VehicleMaintenanceRecord"("vehicleId", "startsAt", "endsAt");
CREATE INDEX "VehicleMaintenanceRecord_status_startsAt_idx"
  ON "VehicleMaintenanceRecord"("status", "startsAt");
CREATE INDEX "VehicleMaintenanceRecord_completedAt_idx"
  ON "VehicleMaintenanceRecord"("completedAt");

ALTER TABLE "VehicleMaintenanceRecord"
  ADD CONSTRAINT "VehicleMaintenanceRecord_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VehicleMaintenanceRecord"
  ADD CONSTRAINT "VehicleMaintenanceRecord_availabilityBlockId_fkey"
  FOREIGN KEY ("availabilityBlockId") REFERENCES "VehicleAvailabilityBlock"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VehicleComplianceDocument" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "type" "VehicleDocumentType" NOT NULL,
  "label" TEXT NOT NULL,
  "referenceLast4" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "blocksDispatch" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleComplianceDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleComplianceDocument_label_check"
    CHECK (char_length(trim("label")) BETWEEN 2 AND 120),
  CONSTRAINT "VehicleComplianceDocument_reference_last4_check"
    CHECK ("referenceLast4" IS NULL OR "referenceLast4" ~ '^[A-Za-z0-9]{1,4}$'),
  CONSTRAINT "VehicleComplianceDocument_window_check"
    CHECK ("issuedAt" IS NULL OR "expiresAt" IS NULL OR "issuedAt" < "expiresAt")
);

CREATE INDEX "VehicleComplianceDocument_vehicleId_type_idx"
  ON "VehicleComplianceDocument"("vehicleId", "type");
CREATE INDEX "VehicleComplianceDocument_expiresAt_idx"
  ON "VehicleComplianceDocument"("expiresAt");
CREATE INDEX "VehicleComplianceDocument_blocksDispatch_expiresAt_idx"
  ON "VehicleComplianceDocument"("blocksDispatch", "expiresAt");

ALTER TABLE "VehicleComplianceDocument"
  ADD CONSTRAINT "VehicleComplianceDocument_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
