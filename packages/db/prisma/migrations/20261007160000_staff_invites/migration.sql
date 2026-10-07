CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvite_userId_key"
ON "StaffInvite"("userId");

CREATE UNIQUE INDEX "StaffInvite_tokenHash_key"
ON "StaffInvite"("tokenHash");

CREATE INDEX "StaffInvite_createdById_createdAt_idx"
ON "StaffInvite"("createdById", "createdAt");

CREATE INDEX "StaffInvite_expiresAt_idx"
ON "StaffInvite"("expiresAt");

CREATE INDEX "StaffInvite_acceptedAt_idx"
ON "StaffInvite"("acceptedAt");

CREATE INDEX "StaffInvite_revokedAt_idx"
ON "StaffInvite"("revokedAt");

ALTER TABLE "StaffInvite"
ADD CONSTRAINT "StaffInvite_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffInvite"
ADD CONSTRAINT "StaffInvite_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
