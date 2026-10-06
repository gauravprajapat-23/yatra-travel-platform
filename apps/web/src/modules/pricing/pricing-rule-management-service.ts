import { getDb, Prisma } from "@yatra/db/client";
import {
  pricingBases,
  tripTypes,
  type PricingBasis,
  type TripType,
} from "@yatra/domain/pricing/rule-selection";

export const pricingRuleStatuses = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
] as const;
export type PricingRuleStatusValue = (typeof pricingRuleStatuses)[number];

export function isPricingRuleStatus(
  value: string,
): value is PricingRuleStatusValue {
  return (pricingRuleStatuses as readonly string[]).includes(value);
}

export function isTripType(value: string): value is TripType {
  return (tripTypes as readonly string[]).includes(value);
}

export function isPricingBasis(value: string): value is PricingBasis {
  return (pricingBases as readonly string[]).includes(value);
}

function normalizeScope(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/s+/g, " ");
  return normalized || null;
}

function assertCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a three-letter uppercase code.");
  }
  return currency;
}

function assertNonNegative(value: bigint | null, label: string) {
  if (value !== null && value < 0n) {
    throw new Error(`${label} cannot be negative.`);
  }
}

function assertRuleShape(input: {
  basis: PricingBasis;
  baseAmountMinor: bigint | null;
  perKmMinor: bigint | null;
  minimumDistanceKm: number | null;
  driverAllowancePerDayMinor: bigint | null;
  nightAllowanceMinor: bigint | null;
  activeFrom: Date | null;
  activeTo: Date | null;
}) {
  assertNonNegative(input.baseAmountMinor, "Base amount");
  assertNonNegative(input.perKmMinor, "Per-km amount");
  assertNonNegative(input.driverAllowancePerDayMinor, "Driver allowance");
  assertNonNegative(input.nightAllowanceMinor, "Night allowance");

  if (
    input.minimumDistanceKm !== null &&
    (!Number.isInteger(input.minimumDistanceKm) ||
      input.minimumDistanceKm < 0 ||
      input.minimumDistanceKm > 100000)
  ) {
    throw new Error("Minimum distance must be a non-negative whole number.");
  }

  if (input.basis === "FIXED" && input.baseAmountMinor === null) {
    throw new Error("Fixed pricing requires a base amount.");
  }

  if (input.basis === "PER_KM" && input.perKmMinor === null) {
    throw new Error("Per-km pricing requires a per-km amount.");
  }

  if (
    input.activeFrom &&
    input.activeTo &&
    input.activeFrom >= input.activeTo
  ) {
    throw new Error("Rule end date must be after its start date.");
  }
}

function windowsOverlap(
  aStart: Date | null,
  aEnd: Date | null,
  bStart: Date | null,
  bEnd: Date | null,
): boolean {
  const startA = aStart?.getTime() ?? Number.NEGATIVE_INFINITY;
  const endA = aEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  const startB = bStart?.getTime() ?? Number.NEGATIVE_INFINITY;
  const endB = bEnd?.getTime() ?? Number.POSITIVE_INFINITY;
  return startA < endB && startB < endA;
}

async function assertNoAmbiguousActiveRule(
  tx: Prisma.TransactionClient,
  input: {
    excludeId?: string;
    vehicleClassId: string;
    tripType: TripType;
    originKey: string | null;
    destinationKey: string | null;
    priority: number;
    activeFrom: Date | null;
    activeTo: Date | null;
    status: PricingRuleStatusValue;
  },
) {
  if (input.status !== "ACTIVE") return;

  const candidates = await tx.pricingRule.findMany({
    where: {
      id: input.excludeId ? { not: input.excludeId } : undefined,
      vehicleClassId: input.vehicleClassId,
      tripType: input.tripType,
      status: "ACTIVE",
      originKey: input.originKey,
      destinationKey: input.destinationKey,
      priority: input.priority,
    },
    select: {
      id: true,
      activeFrom: true,
      activeTo: true,
    },
  });

  const conflict = candidates.find((candidate) =>
    windowsOverlap(
      input.activeFrom,
      input.activeTo,
      candidate.activeFrom,
      candidate.activeTo,
    ),
  );

  if (conflict) {
    throw new Error(
      "Ambiguous pricing rule: another active rule has the same scope, priority and overlapping effective dates.",
    );
  }
}

export async function savePricingRule(input: {
  id?: string;
  name: string;
  vehicleClassId: string;
  tripType: TripType;
  basis: PricingBasis;
  currency: string;
  baseAmountMinor: bigint | null;
  perKmMinor: bigint | null;
  minimumDistanceKm: number | null;
  driverAllowancePerDayMinor: bigint | null;
  nightAllowanceMinor: bigint | null;
  originKey: string;
  destinationKey: string;
  priority: number;
  status: PricingRuleStatusValue;
  activeFrom: Date | null;
  activeTo: Date | null;
  actorUserId: string;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) {
    throw new Error("Rule name must be between 2 and 160 characters.");
  }
  if (!Number.isInteger(input.priority) || input.priority < -100000 || input.priority > 100000) {
    throw new Error("Priority must be a whole number between -100000 and 100000.");
  }

  const currency = assertCurrency(input.currency);
  const originKey = normalizeScope(input.originKey);
  const destinationKey = normalizeScope(input.destinationKey);

  assertRuleShape(input);

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const vehicleClass = await tx.vehicleClass.findFirst({
        where: { id: input.vehicleClassId, isActive: true },
        select: { id: true },
      });
      if (!vehicleClass) throw new Error("Vehicle class is not active.");

      await assertNoAmbiguousActiveRule(tx, {
        excludeId: input.id,
        vehicleClassId: input.vehicleClassId,
        tripType: input.tripType,
        originKey,
        destinationKey,
        priority: input.priority,
        activeFrom: input.activeFrom,
        activeTo: input.activeTo,
        status: input.status,
      });

      const data = {
        name,
        vehicleClassId: input.vehicleClassId,
        tripType: input.tripType,
        basis: input.basis,
        currency,
        baseAmountMinor:
          input.basis === "FIXED" ? input.baseAmountMinor : null,
        perKmMinor:
          input.basis === "PER_KM" ? input.perKmMinor : null,
        minimumDistanceKm:
          input.basis === "PER_KM" ? input.minimumDistanceKm : null,
        driverAllowancePerDayMinor: input.driverAllowancePerDayMinor,
        nightAllowanceMinor: input.nightAllowanceMinor,
        originKey,
        destinationKey,
        priority: input.priority,
        status: input.status,
        activeFrom: input.activeFrom,
        activeTo: input.activeTo,
      };

      let rule;
      let action: string;

      if (input.id) {
        const existing = await tx.pricingRule.findUnique({
          where: { id: input.id },
          select: { id: true, status: true },
        });
        if (!existing) throw new Error("Pricing rule not found.");

        rule = await tx.pricingRule.update({
          where: { id: input.id },
          data,
        });
        action = "PRICING_RULE_UPDATED";
      } else {
        rule = await tx.pricingRule.create({ data });
        action = "PRICING_RULE_CREATED";
      }

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action,
          entityType: "PricingRule",
          entityId: rule.id,
          metadata: {
            name,
            vehicleClassId: input.vehicleClassId,
            tripType: input.tripType,
            basis: input.basis,
            currency,
            priority: input.priority,
            status: input.status,
            originKey,
            destinationKey,
            activeFrom: input.activeFrom?.toISOString() ?? null,
            activeTo: input.activeTo?.toISOString() ?? null,
          },
        },
      });

      return rule;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
