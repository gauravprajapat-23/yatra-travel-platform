-- CreateEnum
CREATE TYPE "BookingPolicyStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'RETIRED'
);

-- CreateTable
CREATE TABLE "BookingPolicyVersion" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "BookingPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "document" JSONB NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingPolicyVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingPolicyVersion_version_check" CHECK ("version" > 0),
  CONSTRAINT "BookingPolicyVersion_code_check" CHECK ("code" ~ '^[A-Z0-9_]+$'),
  CONSTRAINT "BookingPolicyVersion_effective_range_check" CHECK (
    "effectiveFrom" IS NULL
    OR "effectiveTo" IS NULL
    OR "effectiveFrom" < "effectiveTo"
  )
);

-- One immutable version number per policy code.
CREATE UNIQUE INDEX "BookingPolicyVersion_code_version_key"
  ON "BookingPolicyVersion"("code", "version");

-- At most one ACTIVE version per policy code.
CREATE UNIQUE INDEX "BookingPolicyVersion_one_active_per_code_idx"
  ON "BookingPolicyVersion"("code")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "BookingPolicyVersion_code_status_effective_idx"
  ON "BookingPolicyVersion"("code", "status", "effectiveFrom", "effectiveTo");

-- Extend booking with idempotency request fingerprint and policy traceability.
ALTER TABLE "CarBooking"
  ADD COLUMN "requestFingerprint" TEXT,
  ADD COLUMN "bookingPolicyVersionId" TEXT;

-- Backward-safe backfill for any pre-existing booking rows.
UPDATE "CarBooking"
SET "requestFingerprint" = "idempotencyKey"
WHERE "requestFingerprint" IS NULL;

ALTER TABLE "CarBooking"
  ALTER COLUMN "requestFingerprint" SET NOT NULL;

CREATE INDEX "CarBooking_bookingPolicyVersionId_idx"
  ON "CarBooking"("bookingPolicyVersionId");

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_bookingPolicyVersionId_fkey"
  FOREIGN KEY ("bookingPolicyVersionId")
  REFERENCES "BookingPolicyVersion"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
