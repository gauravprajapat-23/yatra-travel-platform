import { getDb, Prisma } from "@yatra/db/client";

export const faqScopes = [
  "GENERAL",
  "BOOKING",
  "PRICING",
  "CANCELLATION",
  "VEHICLES",
  "PACKAGES",
] as const;

export const faqStatuses = [
  "DRAFT",
  "REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type FaqScopeValue = (typeof faqScopes)[number];
export type FaqStatusValue = (typeof faqStatuses)[number];

export function isFaqScope(value: string): value is FaqScopeValue {
  return (faqScopes as readonly string[]).includes(value);
}

export function isFaqStatus(value: string): value is FaqStatusValue {
  return (faqStatuses as readonly string[]).includes(value);
}

function assertFaq(input: {
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatusValue;
  scheduledFor: Date | null;
}) {
  const question = input.question.trim();
  const answer = input.answer.trim();

  if (question.length < 5 || question.length > 500) {
    throw new Error("FAQ question must be between 5 and 500 characters.");
  }

  if (answer.length < 5 || answer.length > 5000) {
    throw new Error("FAQ answer must be between 5 and 5000 characters.");
  }

  if (
    !Number.isInteger(input.sortOrder) ||
    input.sortOrder < -100000 ||
    input.sortOrder > 100000
  ) {
    throw new Error("Sort order must be a whole number between -100000 and 100000.");
  }

  if (input.status === "SCHEDULED" && !input.scheduledFor) {
    throw new Error("Scheduled FAQs require a schedule date.");
  }

  return { question, answer };
}

export async function createFaq(input: {
  scope: FaqScopeValue;
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatusValue;
  scheduledFor: Date | null;
  actorUserId: string;
}) {
  const normalized = assertFaq(input);
  const db = getDb();
  const now = new Date();

  return db.$transaction(
    async (tx) => {
      const faq = await tx.faq.create({
        data: {
          scope: input.scope,
          question: normalized.question,
          answer: normalized.answer,
          sortOrder: input.sortOrder,
          status: input.status,
          scheduledFor:
            input.status === "SCHEDULED" ? input.scheduledFor : null,
          publishedAt:
            input.status === "PUBLISHED" ? now : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "FAQ_CREATED",
          entityType: "Faq",
          entityId: faq.id,
          metadata: {
            scope: faq.scope,
            status: faq.status,
            sortOrder: faq.sortOrder,
          },
        },
      });

      return faq;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateFaq(input: {
  faqId: string;
  scope: FaqScopeValue;
  question: string;
  answer: string;
  sortOrder: number;
  status: FaqStatusValue;
  scheduledFor: Date | null;
  actorUserId: string;
}) {
  const normalized = assertFaq(input);
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.faq.findUnique({
        where: { id: input.faqId },
      });
      if (!current) throw new Error("FAQ not found.");

      const latestRevision = await tx.contentRevision.aggregate({
        where: {
          entityType: "faq",
          entityId: input.faqId,
        },
        _max: { version: true },
      });

      await tx.contentRevision.create({
        data: {
          entityType: "faq",
          entityId: input.faqId,
          version: (latestRevision._max.version ?? 0) + 1,
          createdBy: input.actorUserId,
          payload: {
            scope: current.scope,
            question: current.question,
            answer: current.answer,
            sortOrder: current.sortOrder,
            status: current.status,
            publishedAt: current.publishedAt?.toISOString() ?? null,
            scheduledFor: current.scheduledFor?.toISOString() ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      const faq = await tx.faq.update({
        where: { id: input.faqId },
        data: {
          scope: input.scope,
          question: normalized.question,
          answer: normalized.answer,
          sortOrder: input.sortOrder,
          status: input.status,
          scheduledFor:
            input.status === "SCHEDULED" ? input.scheduledFor : null,
          publishedAt:
            input.status === "PUBLISHED"
              ? current.publishedAt ?? new Date()
              : current.publishedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "FAQ_UPDATED",
          entityType: "Faq",
          entityId: faq.id,
          metadata: {
            fromStatus: current.status,
            toStatus: faq.status,
            scope: faq.scope,
            sortOrder: faq.sortOrder,
          },
        },
      });

      return faq;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
