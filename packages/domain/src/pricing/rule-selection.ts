export const tripTypes = [
  "ONE_WAY",
  "ROUND_TRIP",
  "MULTI_CITY",
] as const;

export const pricingBases = [
  "PER_KM",
  "FIXED",
  "QUOTE_ONLY",
] as const;

export type TripType = (typeof tripTypes)[number];
export type PricingBasis = (typeof pricingBases)[number];

export type PricingRuleCandidate = {
  id: string;
  vehicleClassId: string;
  tripType: TripType;
  basis: PricingBasis;
  currency: string;
  originKey: string | null;
  destinationKey: string | null;
  priority: number;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
  activeFrom: Date | null;
  activeTo: Date | null;
};

export type PricingRuleSelectionInput = {
  vehicleClassId: string;
  tripType: TripType;
  originKey?: string | null;
  destinationKey?: string | null;
  at?: Date;
};

function isActiveAt(rule: PricingRuleCandidate, at: Date): boolean {
  if (rule.status !== "ACTIVE") {
    return false;
  }

  if (rule.activeFrom && rule.activeFrom > at) {
    return false;
  }

  if (rule.activeTo && rule.activeTo <= at) {
    return false;
  }

  return true;
}

function matchesScope(
  configured: string | null,
  requested: string | null | undefined,
): boolean {
  return configured === null || configured === requested;
}

function specificity(rule: PricingRuleCandidate): number {
  return Number(rule.originKey !== null) + Number(rule.destinationKey !== null);
}

export function selectPricingRule(
  rules: readonly PricingRuleCandidate[],
  input: PricingRuleSelectionInput,
): PricingRuleCandidate | null {
  const at = input.at ?? new Date();

  const eligible = rules
    .filter(
      (rule) =>
        rule.vehicleClassId === input.vehicleClassId &&
        rule.tripType === input.tripType &&
        isActiveAt(rule, at) &&
        matchesScope(rule.originKey, input.originKey) &&
        matchesScope(rule.destinationKey, input.destinationKey),
    )
    .sort((a, b) => {
      const specificityDifference = specificity(b) - specificity(a);

      if (specificityDifference !== 0) {
        return specificityDifference;
      }

      return b.priority - a.priority;
    });

  if (eligible.length === 0) {
    return null;
  }

  if (eligible.length > 1) {
    const first = eligible[0];
    const second = eligible[1];

    if (
      specificity(first) === specificity(second) &&
      first.priority === second.priority
    ) {
      throw new Error(
        "Ambiguous pricing rules: multiple active rules have equal specificity and priority.",
      );
    }
  }

  return eligible[0];
}

export function assertMoneyMinor(value: bigint | null, field: string): void {
  if (value !== null && value < 0n) {
    throw new Error(`${field} cannot be negative.`);
  }
}
