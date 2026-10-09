CREATE TYPE "PackageDepartureStatus" AS ENUM (
  'DRAFT',
  'OPEN',
  'CLOSED',
  'SOLD_OUT',
  'CANCELLED',
  'COMPLETED'
);

CREATE TABLE "PackageDeparture" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "status" "PackageDepartureStatus" NOT NULL DEFAULT 'DRAFT',
  "capacityTravellers" INTEGER,
  "reservedTravellers" INTEGER NOT NULL DEFAULT 0,
  "salesOpenAt" TIMESTAMP(3),
  "salesCloseAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PackageDeparture_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PackageDeparture_window_check"
    CHECK ("endsAt" IS NULL OR "startsAt" < "endsAt"),
  CONSTRAINT "PackageDeparture_capacity_check"
    CHECK (
      "capacityTravellers" IS NULL
      OR (
        "capacityTravellers" > 0
        AND "reservedTravellers" >= 0
        AND "reservedTravellers" <= "capacityTravellers"
      )
    ),
  CONSTRAINT "PackageDeparture_unlimited_reserved_check"
    CHECK (
      "capacityTravellers" IS NOT NULL
      OR "reservedTravellers" >= 0
    ),
  CONSTRAINT "PackageDeparture_sales_window_check"
    CHECK (
      "salesOpenAt" IS NULL
      OR "salesCloseAt" IS NULL
      OR "salesOpenAt" < "salesCloseAt"
    ),
  CONSTRAINT "PackageDeparture_sales_before_departure_check"
    CHECK (
      "salesCloseAt" IS NULL
      OR "salesCloseAt" <= "startsAt"
    )
);

CREATE UNIQUE INDEX "PackageDeparture_packageId_startsAt_key"
  ON "PackageDeparture"("packageId", "startsAt");
CREATE INDEX "PackageDeparture_packageId_status_startsAt_idx"
  ON "PackageDeparture"("packageId", "status", "startsAt");
CREATE INDEX "PackageDeparture_status_salesOpenAt_salesCloseAt_idx"
  ON "PackageDeparture"("status", "salesOpenAt", "salesCloseAt");

ALTER TABLE "PackageDeparture"
  ADD CONSTRAINT "PackageDeparture_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PackageQuote"
  ADD COLUMN "departureId" TEXT,
  ADD COLUMN "departureSnapshot" JSONB;

CREATE INDEX "PackageQuote_departureId_idx"
  ON "PackageQuote"("departureId");

ALTER TABLE "PackageQuote"
  ADD CONSTRAINT "PackageQuote_departureId_fkey"
  FOREIGN KEY ("departureId") REFERENCES "PackageDeparture"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD COLUMN "departureId" TEXT,
  ADD COLUMN "departureSnapshot" JSONB,
  ADD COLUMN "inventoryReleasedAt" TIMESTAMP(3);

CREATE INDEX "PackageBooking_departureId_status_idx"
  ON "PackageBooking"("departureId", "status");

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_departureId_fkey"
  FOREIGN KEY ("departureId") REFERENCES "PackageDeparture"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
