CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "PromotionScope" AS ENUM ('ALL', 'CAR', 'PACKAGE');
CREATE TYPE "PromotionDiscountKind" AS ENUM ('PERCENTAGE', 'FIXED');

CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
  "scope" "PromotionScope" NOT NULL DEFAULT 'ALL',
  "discountKind" "PromotionDiscountKind" NOT NULL,
  "percentageBps" INTEGER,
  "fixedAmountMinor" BIGINT,
  "currency" TEXT,
  "minSubtotalMinor" BIGINT,
  "maxDiscountMinor" BIGINT,
  "maxRedemptions" INTEGER,
  "redeemedCount" INTEGER NOT NULL DEFAULT 0,
  "perCustomerLimit" INTEGER,
  "activeFrom" TIMESTAMP(3),
  "activeTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Promotion_code_format_check"
    CHECK ("code" = upper("code") AND "code" ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  CONSTRAINT "Promotion_discount_mode_check"
    CHECK (
      (
        "discountKind" = 'PERCENTAGE'
        AND "percentageBps" BETWEEN 1 AND 10000
        AND "fixedAmountMinor" IS NULL
      )
      OR
      (
        "discountKind" = 'FIXED'
        AND "fixedAmountMinor" > 0
        AND "percentageBps" IS NULL
        AND "currency" IS NOT NULL
      )
    ),
  CONSTRAINT "Promotion_currency_format_check"
    CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Promotion_min_subtotal_check"
    CHECK ("minSubtotalMinor" IS NULL OR "minSubtotalMinor" >= 0),
  CONSTRAINT "Promotion_max_discount_check"
    CHECK ("maxDiscountMinor" IS NULL OR "maxDiscountMinor" > 0),
  CONSTRAINT "Promotion_max_redemptions_check"
    CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" > 0),
  CONSTRAINT "Promotion_redeemed_count_check"
    CHECK (
      "redeemedCount" >= 0
      AND ("maxRedemptions" IS NULL OR "redeemedCount" <= "maxRedemptions")
    ),
  CONSTRAINT "Promotion_per_customer_limit_check"
    CHECK ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0),
  CONSTRAINT "Promotion_active_window_check"
    CHECK ("activeFrom" IS NULL OR "activeTo" IS NULL OR "activeFrom" < "activeTo")
);

CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
CREATE INDEX "Promotion_status_activeFrom_activeTo_idx"
  ON "Promotion"("status", "activeFrom", "activeTo");
CREATE INDEX "Promotion_scope_status_idx"
  ON "Promotion"("scope", "status");

ALTER TABLE "CarQuote"
  ADD COLUMN "promotionId" TEXT,
  ADD COLUMN "promotionSnapshot" JSONB;

ALTER TABLE "CarBooking"
  ADD COLUMN "promotionId" TEXT,
  ADD COLUMN "promotionSnapshot" JSONB;

ALTER TABLE "PackageQuote"
  ADD COLUMN "promotionId" TEXT,
  ADD COLUMN "promotionSnapshot" JSONB;

ALTER TABLE "PackageBooking"
  ADD COLUMN "promotionId" TEXT,
  ADD COLUMN "promotionSnapshot" JSONB;

CREATE INDEX "CarQuote_promotionId_idx" ON "CarQuote"("promotionId");
CREATE INDEX "CarBooking_promotionId_idx" ON "CarBooking"("promotionId");
CREATE INDEX "PackageQuote_promotionId_idx" ON "PackageQuote"("promotionId");
CREATE INDEX "PackageBooking_promotionId_idx" ON "PackageBooking"("promotionId");

ALTER TABLE "CarQuote"
  ADD CONSTRAINT "CarQuote_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarBooking"
  ADD CONSTRAINT "CarBooking_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageQuote"
  ADD CONSTRAINT "PackageQuote_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PackageBooking"
  ADD CONSTRAINT "PackageBooking_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PromotionRedemption" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "customerUserId" TEXT,
  "guestEmailNormalized" TEXT,
  "carBookingId" TEXT,
  "packageBookingId" TEXT,
  "currency" TEXT NOT NULL,
  "discountMinor" BIGINT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromotionRedemption_booking_identity_check"
    CHECK (
      ("carBookingId" IS NOT NULL AND "packageBookingId" IS NULL)
      OR
      ("carBookingId" IS NULL AND "packageBookingId" IS NOT NULL)
    ),
  CONSTRAINT "PromotionRedemption_customer_identity_check"
    CHECK (
      ("customerUserId" IS NOT NULL AND "guestEmailNormalized" IS NULL)
      OR
      ("customerUserId" IS NULL AND "guestEmailNormalized" IS NOT NULL)
    ),
  CONSTRAINT "PromotionRedemption_guest_email_normalized_check"
    CHECK (
      "guestEmailNormalized" IS NULL
      OR "guestEmailNormalized" = lower(trim("guestEmailNormalized"))
    ),
  CONSTRAINT "PromotionRedemption_currency_format_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PromotionRedemption_discount_check"
    CHECK ("discountMinor" > 0)
);

CREATE UNIQUE INDEX "PromotionRedemption_carBookingId_key"
  ON "PromotionRedemption"("carBookingId");
CREATE UNIQUE INDEX "PromotionRedemption_packageBookingId_key"
  ON "PromotionRedemption"("packageBookingId");
CREATE INDEX "PromotionRedemption_promotionId_redeemedAt_idx"
  ON "PromotionRedemption"("promotionId", "redeemedAt");
CREATE INDEX "PromotionRedemption_customerUserId_promotionId_idx"
  ON "PromotionRedemption"("customerUserId", "promotionId");
CREATE INDEX "PromotionRedemption_guestEmailNormalized_promotionId_idx"
  ON "PromotionRedemption"("guestEmailNormalized", "promotionId");

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_carBookingId_fkey"
  FOREIGN KEY ("carBookingId") REFERENCES "CarBooking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption"
  ADD CONSTRAINT "PromotionRedemption_packageBookingId_fkey"
  FOREIGN KEY ("packageBookingId") REFERENCES "PackageBooking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
