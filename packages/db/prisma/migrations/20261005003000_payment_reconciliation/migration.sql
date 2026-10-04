-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY');

CREATE TYPE "PaymentStatus" AS ENUM (
  'CREATED',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED'
);

CREATE TYPE "RefundStatus" AS ENUM (
  'PENDING',
  'PROCESSED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "PaymentIntent" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "idempotencyKey" TEXT NOT NULL,
  "carBookingId" TEXT,
  "packageBookingId" TEXT,
  "providerOrderId" TEXT,
  "providerPaymentId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "amountMinor" BIGINT NOT NULL,
  "amountPaidMinor" BIGINT NOT NULL DEFAULT 0,
  "receipt" TEXT,
  "authorizedAt" TIMESTAMP(3),
  "capturedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentIntent_subject_check" CHECK (
    ("carBookingId" IS NOT NULL AND "packageBookingId" IS NULL)
    OR ("carBookingId" IS NULL AND "packageBookingId" IS NOT NULL)
  ),
  CONSTRAINT "PaymentIntent_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PaymentIntent_amount_check" CHECK (
    "amountMinor" >= 0
    AND "amountPaidMinor" >= 0
    AND "amountPaidMinor" <= "amountMinor"
  )
);

CREATE TABLE "PaymentWebhookEvent" (
  "id" BIGSERIAL NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
  "dedupeKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signatureVerifiedAt" TIMESTAMP(3) NOT NULL,
  "paymentIntentId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "processingError" TEXT,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentWebhookEvent_dedupe_key_check" CHECK (length(trim("dedupeKey")) > 0),
  CONSTRAINT "PaymentWebhookEvent_event_type_check" CHECK (length(trim("eventType")) > 0)
);

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "paymentIntentId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "amountMinor" BIGINT NOT NULL,
  "reason" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Refund_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Refund_amount_check" CHECK ("amountMinor" > 0)
);

CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentIntent_providerOrderId_key" ON "PaymentIntent"("providerOrderId");
CREATE UNIQUE INDEX "PaymentIntent_providerPaymentId_key" ON "PaymentIntent"("providerPaymentId");
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_dedupeKey_key"
  ON "PaymentWebhookEvent"("provider", "dedupeKey");
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

CREATE INDEX "PaymentIntent_carBookingId_createdAt_idx"
  ON "PaymentIntent"("carBookingId", "createdAt");
CREATE INDEX "PaymentIntent_packageBookingId_createdAt_idx"
  ON "PaymentIntent"("packageBookingId", "createdAt");
CREATE INDEX "PaymentIntent_status_createdAt_idx"
  ON "PaymentIntent"("status", "createdAt");
CREATE INDEX "PaymentWebhookEvent_paymentIntentId_receivedAt_idx"
  ON "PaymentWebhookEvent"("paymentIntentId", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_eventType_receivedAt_idx"
  ON "PaymentWebhookEvent"("eventType", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_processedAt_idx"
  ON "PaymentWebhookEvent"("processedAt");
CREATE INDEX "Refund_paymentIntentId_createdAt_idx"
  ON "Refund"("paymentIntentId", "createdAt");
CREATE INDEX "Refund_status_createdAt_idx"
  ON "Refund"("status", "createdAt");

ALTER TABLE "PaymentIntent"
  ADD CONSTRAINT "PaymentIntent_carBookingId_fkey"
  FOREIGN KEY ("carBookingId") REFERENCES "CarBooking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentIntent"
  ADD CONSTRAINT "PaymentIntent_packageBookingId_fkey"
  FOREIGN KEY ("packageBookingId") REFERENCES "PackageBooking"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentWebhookEvent"
  ADD CONSTRAINT "PaymentWebhookEvent_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_paymentIntentId_fkey"
  FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
