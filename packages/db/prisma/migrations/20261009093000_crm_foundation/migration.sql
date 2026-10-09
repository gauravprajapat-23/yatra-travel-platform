CREATE TYPE "CrmInteractionType" AS ENUM (
  'NOTE',
  'CALL',
  'EMAIL',
  'SMS',
  'WHATSAPP',
  'OTHER'
);

CREATE TYPE "CrmInteractionDirection" AS ENUM (
  'INTERNAL',
  'INBOUND',
  'OUTBOUND'
);

CREATE TYPE "CrmFollowUpStatus" AS ENUM (
  'OPEN',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "CrmInteraction" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "customerUserId" TEXT,
  "customerEmailNormalized" TEXT,
  "type" "CrmInteractionType" NOT NULL,
  "direction" "CrmInteractionDirection" NOT NULL DEFAULT 'INTERNAL',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmInteraction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmInteraction_subject_identity_check"
    CHECK (
      (CASE WHEN "leadId" IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN "customerUserId" IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN "customerEmailNormalized" IS NULL THEN 0 ELSE 1 END)
      = 1
    ),
  CONSTRAINT "CrmInteraction_guest_email_normalized_check"
    CHECK (
      "customerEmailNormalized" IS NULL
      OR "customerEmailNormalized" = lower(trim("customerEmailNormalized"))
    ),
  CONSTRAINT "CrmInteraction_body_check"
    CHECK (char_length(trim("body")) BETWEEN 1 AND 5000),
  CONSTRAINT "CrmInteraction_subject_check"
    CHECK ("subject" IS NULL OR char_length(trim("subject")) BETWEEN 1 AND 200)
);

CREATE INDEX "CrmInteraction_leadId_occurredAt_idx"
  ON "CrmInteraction"("leadId", "occurredAt");
CREATE INDEX "CrmInteraction_customerUserId_occurredAt_idx"
  ON "CrmInteraction"("customerUserId", "occurredAt");
CREATE INDEX "CrmInteraction_customerEmailNormalized_occurredAt_idx"
  ON "CrmInteraction"("customerEmailNormalized", "occurredAt");
CREATE INDEX "CrmInteraction_createdByUserId_occurredAt_idx"
  ON "CrmInteraction"("createdByUserId", "occurredAt");
CREATE INDEX "CrmInteraction_type_occurredAt_idx"
  ON "CrmInteraction"("type", "occurredAt");

ALTER TABLE "CrmInteraction"
  ADD CONSTRAINT "CrmInteraction_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmInteraction"
  ADD CONSTRAINT "CrmInteraction_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmInteraction"
  ADD CONSTRAINT "CrmInteraction_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CrmFollowUpTask" (
  "id" TEXT NOT NULL,
  "leadId" TEXT,
  "customerUserId" TEXT,
  "customerEmailNormalized" TEXT,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "status" "CrmFollowUpStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "assignedToUserId" TEXT,
  "createdByUserId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmFollowUpTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmFollowUpTask_subject_identity_check"
    CHECK (
      (CASE WHEN "leadId" IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN "customerUserId" IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN "customerEmailNormalized" IS NULL THEN 0 ELSE 1 END)
      = 1
    ),
  CONSTRAINT "CrmFollowUpTask_guest_email_normalized_check"
    CHECK (
      "customerEmailNormalized" IS NULL
      OR "customerEmailNormalized" = lower(trim("customerEmailNormalized"))
    ),
  CONSTRAINT "CrmFollowUpTask_title_check"
    CHECK (char_length(trim("title")) BETWEEN 2 AND 200),
  CONSTRAINT "CrmFollowUpTask_notes_check"
    CHECK ("notes" IS NULL OR char_length(trim("notes")) <= 5000),
  CONSTRAINT "CrmFollowUpTask_completion_check"
    CHECK (
      ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
      OR
      ("status" <> 'COMPLETED' AND "completedAt" IS NULL)
    )
);

CREATE INDEX "CrmFollowUpTask_leadId_dueAt_idx"
  ON "CrmFollowUpTask"("leadId", "dueAt");
CREATE INDEX "CrmFollowUpTask_customerUserId_dueAt_idx"
  ON "CrmFollowUpTask"("customerUserId", "dueAt");
CREATE INDEX "CrmFollowUpTask_customerEmailNormalized_dueAt_idx"
  ON "CrmFollowUpTask"("customerEmailNormalized", "dueAt");
CREATE INDEX "CrmFollowUpTask_assignedToUserId_status_dueAt_idx"
  ON "CrmFollowUpTask"("assignedToUserId", "status", "dueAt");
CREATE INDEX "CrmFollowUpTask_status_dueAt_idx"
  ON "CrmFollowUpTask"("status", "dueAt");

ALTER TABLE "CrmFollowUpTask"
  ADD CONSTRAINT "CrmFollowUpTask_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmFollowUpTask"
  ADD CONSTRAINT "CrmFollowUpTask_customerUserId_fkey"
  FOREIGN KEY ("customerUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmFollowUpTask"
  ADD CONSTRAINT "CrmFollowUpTask_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmFollowUpTask"
  ADD CONSTRAINT "CrmFollowUpTask_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
