export type BookingPolicyStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export type BookingPolicyCandidate = {
  id: string;
  code: string;
  version: number;
  status: BookingPolicyStatus;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  document: unknown;
};

export function selectActiveBookingPolicy(
  policies: readonly BookingPolicyCandidate[],
  code: string,
  at = new Date(),
): BookingPolicyCandidate | null {
  const eligible = policies.filter((policy) => {
    if (policy.code !== code || policy.status !== "ACTIVE") {
      return false;
    }

    if (policy.effectiveFrom && policy.effectiveFrom > at) {
      return false;
    }

    if (policy.effectiveTo && policy.effectiveTo <= at) {
      return false;
    }

    return true;
  });

  if (eligible.length === 0) {
    return null;
  }

  if (eligible.length > 1) {
    throw new Error(
      `Multiple active booking policies found for code ${code}.`,
    );
  }

  return eligible[0];
}

export function createPolicySnapshot(policy: BookingPolicyCandidate) {
  if (!Number.isInteger(policy.version) || policy.version <= 0) {
    throw new Error("Booking policy version must be a positive integer.");
  }

  if (
    policy.document === null ||
    typeof policy.document !== "object" ||
    Array.isArray(policy.document)
  ) {
    throw new Error("Booking policy document must be a JSON object.");
  }

  return {
    policyId: policy.id,
    code: policy.code,
    version: policy.version,
    document: policy.document,
  } as const;
}
