-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM (
  'DRAFT',
  'PENDING_PAYMENT',
  'PENDING_REVIEW',
  'CONFIRMED',
  'DRIVER_ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'REFUND_PENDING',
  'REFUNDED'
);

-- CreateTable
CREATE TABLE "CarQuote" (
  "id" TEXT NOT NULL,
  "tripType" "TripType" NOT NULL,
  "originText" TEXT NOT NULL,
  "destinationText" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "travellers" INTEGER NOT NULL,
  "vehicleClassId" TEXT NOT NULL,
  "pricingRuleId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotalMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "taxMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL,
  "priceBreakdown" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CarQuote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CarQuote_travellers_check" CHECK ("travellers" > 0),
  CONSTRAINT "CarQuote_trip_range_check" CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt"),
  CONSTRAINT "CarQuote_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CarQuote_money_check" CHECK (
    "subtotalMinor" >= 0
    AND "discountMinor" >= 0
    AND "taxMinor" >= 0
    AND "totalMinor" >= 0
    AND "discountMinor" <= "subtotalMinor" + "taxMinor"
    AND "totalMinor" = "subtotalMinor" - "discountMinor" + "taxMinor"
  ),
  CONSTRAINT "CarQuote_expiry_check" CHECK ("createdAt" < "expiresAt")
);

CREATE TABLE "CarBooking" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "quoteId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
  "tripType" "TripType" NOT NULL,
  "originText" TEXT NOT NULL,
  "destinationText" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "travellers" INTEGER NOT NULL,
  "customerUserId" TEXT,
  "guestName" TEXT,
  "guestEmail" TEXT,
  "guestPhoneCiphertext" TEXT,
  "vehicleClassId" TEXT NOT NULL,
  "selectedVehicleId" TEXT,
  "assignedDriverId" TEXT,
  "pricingRuleId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "subtotalMinor" BIGINT NOT NULL,
  "discountMinor" BIGINT NOT NULL DEFAULT 0,
  "taxMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL,
  "priceSnapshot" JSONB NOT NULL,
  "policySnapshot" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CarBooking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CarBooking_travellers_check" CHECK ("travellers" > 0),
  CONSTRAINT "CarBooking_trip_range_check" CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt"),
  CONSTRAINT "CarBooking_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CarBooking_money_check" CHECK (
    "subtotalMinor" >= 0
    AND "discountMinor" >= 0
    AND "taxMinor" >= 0
    AND "totalMinor" >= 0
    AND "discountMinor" <= "subtotalMinor" + "taxMinor"
    AND "totalMinor" = "subtotalMinor" - "discountMinor" + "taxMinor"
  ),
  CONSTRAINT "CarBooking_customer_identity_check" CHECK (
    "customerUserId" IS NOT NULL
    OR (
      "guestName" IS NOT NULL
      AND length(trim("guestName")) > 0
      AND "guestEmail" IS NOT NULL
      AND length(trim("guestEmail")) > 0
    )
  )
);

CREATE TABLE "BookingStatusHistory" (
  "id" BIGSERIAL NOT NULL,
  "bookingId" TEXT NOT NULL,
  "fromStatus" "BookingStatus",
  "toStatus" "BookingStatus" NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "CarBooking_reference_key" ON "CarBooking"("reference");
CREATE UNIQUE INDEX "CarBooking_quoteId_key" ON "CarBooking"("quoteId");
CREATE UNIQUE INDEX "CarBooking_idempotencyKey_key" ON "CarBooking"("idempotencyKey");

-- Query indexes
CREATE INDEX "CarQuote_vehicleClassId_startsAt_idx" ON "CarQuote"("vehicleClassId", "startsAt");
CREATE INDEX "CarQuote_tripType_idx" ON "CarQuote"("tripType");
CREATE INDEX "CarQuote_expiresAt_idx" ON "CarQuote"("expiresAt");

CREATE INDEX "CarBooking_status_startsAt_idx" ON "CarBooking"("status", "startsAt");
CREATE INDEX "CarBooking_customerUserId_createdAt_idx" ON "CarBooking"("customerUserId", "createdAt");
CREATE INDEX "CarBooking_selectedVehicleId_startsAt_idx" ON "CarBooking"("selectedVehicleId", "startsAt");
CREATE INDEX "CarBooking_assignedDriverId_startsAt_idx" ON "CarBooking"("assignedDriverId", "startsAt");
CREATE INDEX "CarBooking_vehicleClassId_startsAt_idx" ON "CarBooking"("vehicleClassId", "startsAt");

CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx"
  ON "BookingStatusHistory"("bookingId", "createdAt");
CREATE INDEX "BookingStatusHistory_actorUserId_createdAt_idx"
  ON "BookingStatusHistory"("actorUserId", "createdAt");

-- Foreign keys
ALTER TABLE "CarQuote"
  ADD CONSTRAINT "CarQuote_vehicleClassId_fkey"
  FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarQuote"
  ADD CONSTRAINT "CarQuote_pricingRuleId_fkey"
  FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "CarQuote"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_vehicleClassId_fkey"
  FOREIGN KEY ("vehicleClassId") REFERENCES "VehicleClass"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_selectedVehicleId_fkey"
  FOREIGN KEY ("selectedVehicleId") REFERENCES "Vehicle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_assignedDriverId_fkey"
  FOREIGN KEY ("assignedDriverId") REFERENCES "Driver"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_pricingRuleId_fkey"
  FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingStatusHistory"
  ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "CarBooking"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingStatusHistory"
  ADD CONSTRAINT "BookingStatusHistory_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
