import { getDb, Prisma } from "@yatra/db/client";

export const bookingPolicyCodes = [
  "CAR_BOOKING",
  "PACKAGE_BOOKING",
] as const;

export type BookingPolicyCode = (typeof bookingPolicyCodes)[number];

const requiredActivationSections = [
  "cancellation",
  "refundEligibility",
  "rescheduling",
  "noShow",
  "customerResponsibilities",
  "serviceLimitations",
  "bookingTerms",
] as const;

export function isBookingPolicyCode(
  value: string,
): value is BookingPolicyCode {
  return (bookingPolicyCodes as readonly string[]).includes(value);
}

function assertEffectiveRange(
  effectiveFrom: Date | null,
  effectiveTo: Date | null,
) {
  if (
    effectiveFrom &&
    effectiveTo &&
    effectiveFrom >= effectiveTo
  ) {
    throw new Error("Policy effective end must be after its start.");
  }
}

function parseDocument(raw: string): Record<string, unknown> {
  let value: unknown;

  try {
    value = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Policy document must be valid JSON.");
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error("Policy document must be a JSON object.");
  }

  const serialized = JSON.stringify(value);
  if (serialized.length > 200_000) {
    throw new Error("Policy document is too large.");
  }

  return value as Record<string, unknown>;
}

function assertActivationDocument(document: Record<string, unknown>) {
  const missing = requiredActivationSections.filter((key) => {
    const value = document[key];

    if (value === null || value === undefined) return true;

    if (typeof value === "string") {
      return value.trim().length === 0;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === "object") {
      return Object.keys(value as Record<string, unknown>).length === 0;
    }

    return false;
  });

  if (missing.length > 0) {
    throw new Error(
      `Policy cannot be activated until these required sections are completed: ${missing.join(", ")}.`,
    );
  }
}

export function stringifyBookingPolicyDocument(
  value: unknown,
): string {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return "{}";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

export async function createBookingPolicyDraft(input: {
  code: BookingPolicyCode;
  rawDocument: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  actorUserId: string;
}) {
  assertEffectiveRange(input.effectiveFrom, input.effectiveTo);
  const document = parseDocument(input.rawDocument);
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const latest = await tx.bookingPolicyVersion.aggregate({
        where: { code: input.code },
        _max: { version: true },
      });

      const version = (latest._max.version ?? 0) + 1;

      const policy = await tx.bookingPolicyVersion.create({
        data: {
          code: input.code,
          version,
          status: "DRAFT",
          document: document as Prisma.InputJsonValue,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          createdBy: input.actorUserId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "BOOKING_POLICY_DRAFT_CREATED",
          entityType: "BookingPolicyVersion",
          entityId: policy.id,
          metadata: {
            code: input.code,
            version,
            effectiveFrom: input.effectiveFrom?.toISOString() ?? null,
            effectiveTo: input.effectiveTo?.toISOString() ?? null,
          },
        },
      });

      return policy;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function updateBookingPolicyDraft(input: {
  policyId: string;
  rawDocument: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  actorUserId: string;
}) {
  assertEffectiveRange(input.effectiveFrom, input.effectiveTo);
  const document = parseDocument(input.rawDocument);
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.bookingPolicyVersion.findUnique({
        where: { id: input.policyId },
      });

      if (!current) throw new Error("Booking policy version not found.");
      if (current.status !== "DRAFT") {
        throw new Error("Only draft booking policy versions can be edited.");
      }

      const policy = await tx.bookingPolicyVersion.update({
        where: { id: input.policyId },
        data: {
          document: document as Prisma.InputJsonValue,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "BOOKING_POLICY_DRAFT_UPDATED",
          entityType: "BookingPolicyVersion",
          entityId: policy.id,
          metadata: {
            code: policy.code,
            version: policy.version,
            effectiveFrom: input.effectiveFrom?.toISOString() ?? null,
            effectiveTo: input.effectiveTo?.toISOString() ?? null,
          },
        },
      });

      return policy;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function activateBookingPolicy(input: {
  policyId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const target = await tx.bookingPolicyVersion.findUnique({
        where: { id: input.policyId },
      });

      if (!target) throw new Error("Booking policy version not found.");
      if (target.status !== "DRAFT") {
        throw new Error("Only draft booking policy versions can be activated.");
      }

      assertEffectiveRange(target.effectiveFrom, target.effectiveTo);

      const document = target.document as Record<string, unknown>;
      assertActivationDocument(document);

      const currentActive = await tx.bookingPolicyVersion.findFirst({
        where: {
          code: target.code,
          status: "ACTIVE",
        },
        select: { id: true, version: true },
      });

      const now = new Date();

      if (currentActive) {
        await tx.bookingPolicyVersion.update({
          where: { id: currentActive.id },
          data: {
            status: "RETIRED",
            retiredAt: now,
          },
        });
      }

      const activated = await tx.bookingPolicyVersion.update({
        where: { id: target.id },
        data: {
          status: "ACTIVE",
          activatedAt: now,
          retiredAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "BOOKING_POLICY_ACTIVATED",
          entityType: "BookingPolicyVersion",
          entityId: target.id,
          metadata: {
            code: target.code,
            version: target.version,
            retiredVersion: currentActive?.version ?? null,
          },
        },
      });

      return activated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function retireBookingPolicy(input: {
  policyId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.bookingPolicyVersion.findUnique({
        where: { id: input.policyId },
      });

      if (!current) throw new Error("Booking policy version not found.");
      if (current.status !== "ACTIVE") {
        throw new Error("Only an active booking policy can be retired.");
      }

      const policy = await tx.bookingPolicyVersion.update({
        where: { id: input.policyId },
        data: {
          status: "RETIRED",
          retiredAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "BOOKING_POLICY_RETIRED",
          entityType: "BookingPolicyVersion",
          entityId: policy.id,
          metadata: {
            code: policy.code,
            version: policy.version,
          },
        },
      });

      return policy;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
