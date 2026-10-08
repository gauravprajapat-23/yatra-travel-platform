CREATE TYPE "AuthActionPurpose" AS ENUM (
    'EMAIL_VERIFICATION',
    'PASSWORD_RESET'
);

CREATE TYPE "NotificationChannel" AS ENUM (
    'EMAIL',
    'SMS',
    'WHATSAPP'
);

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SENT',
    'FAILED',
    'CANCELLED'
);

CREATE TABLE "AuthActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthActionPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthActionToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "purpose" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthActionToken_tokenHash_key"
ON "AuthActionToken"("tokenHash");

CREATE INDEX "AuthActionToken_userId_purpose_createdAt_idx"
ON "AuthActionToken"("userId", "purpose", "createdAt");

CREATE INDEX "AuthActionToken_purpose_expiresAt_idx"
ON "AuthActionToken"("purpose", "expiresAt");

CREATE INDEX "AuthActionToken_consumedAt_idx"
ON "AuthActionToken"("consumedAt");

CREATE INDEX "AuthActionToken_revokedAt_idx"
ON "AuthActionToken"("revokedAt");

CREATE INDEX "NotificationDelivery_status_createdAt_idx"
ON "NotificationDelivery"("status", "createdAt");

CREATE INDEX "NotificationDelivery_userId_channel_createdAt_idx"
ON "NotificationDelivery"("userId", "channel", "createdAt");

CREATE INDEX "NotificationDelivery_provider_providerMessageId_idx"
ON "NotificationDelivery"("provider", "providerMessageId");

ALTER TABLE "AuthActionToken"
ADD CONSTRAINT "AuthActionToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
