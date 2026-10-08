export const promotionScopes = ["ALL", "CAR", "PACKAGE"] as const;
export type PromotionScope = (typeof promotionScopes)[number];

export const promotionDiscountKinds = ["PERCENTAGE", "FIXED"] as const;
export type PromotionDiscountKind = (typeof promotionDiscountKinds)[number];

export type PromotionRule = {
  scope: PromotionScope;
  discountKind: PromotionDiscountKind;
  percentageBps?: number | null;
  fixedAmountMinor?: bigint | null;
  currency?: string | null;
  minSubtotalMinor?: bigint | null;
  maxDiscountMinor?: bigint | null;
  activeFrom?: Date | null;
  activeTo?: Date | null;
  maxRedemptions?: number | null;
  redeemedCount?: number;
};

export type PromotionContext = {
  bookingType: "CAR" | "PACKAGE";
  subtotalMinor: bigint;
  currency: string;
  at?: Date;
};

export type PromotionDiscount = {
  discountMinor: bigint;
  payableBeforeTaxMinor: bigint;
};

function assertCurrency(value: string): void {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error("Promotion currency must be a three-letter uppercase code.");
  }
}

export function assertPromotionEligible(
  rule: PromotionRule,
  context: PromotionContext,
): void {
  const now = context.at ?? new Date();

  if (context.subtotalMinor < 0n) {
    throw new Error("Promotion subtotal cannot be negative.");
  }

  assertCurrency(context.currency);

  if (rule.scope !== "ALL" && rule.scope !== context.bookingType) {
    throw new Error("Promotion is not valid for this booking type.");
  }

  if (rule.activeFrom && now < rule.activeFrom) {
    throw new Error("Promotion is not active yet.");
  }

  if (rule.activeTo && now >= rule.activeTo) {
    throw new Error("Promotion has expired.");
  }

  if (
    rule.activeFrom &&
    rule.activeTo &&
    rule.activeFrom >= rule.activeTo
  ) {
    throw new Error("Promotion active window is invalid.");
  }

  if (
    rule.minSubtotalMinor !== null &&
    rule.minSubtotalMinor !== undefined &&
    rule.minSubtotalMinor < 0n
  ) {
    throw new Error("Promotion minimum subtotal cannot be negative.");
  }

  if (
    rule.minSubtotalMinor !== null &&
    rule.minSubtotalMinor !== undefined &&
    context.subtotalMinor < rule.minSubtotalMinor
  ) {
    throw new Error("Booking subtotal does not meet the promotion minimum.");
  }

  if (
    rule.maxRedemptions !== null &&
    rule.maxRedemptions !== undefined
  ) {
    if (!Number.isInteger(rule.maxRedemptions) || rule.maxRedemptions <= 0) {
      throw new Error("Promotion redemption limit must be a positive integer.");
    }

    const redeemedCount = rule.redeemedCount ?? 0;
    if (!Number.isInteger(redeemedCount) || redeemedCount < 0) {
      throw new Error("Promotion redeemed count is invalid.");
    }

    if (redeemedCount >= rule.maxRedemptions) {
      throw new Error("Promotion redemption limit has been reached.");
    }
  }

  if (
    rule.maxDiscountMinor !== null &&
    rule.maxDiscountMinor !== undefined &&
    rule.maxDiscountMinor <= 0n
  ) {
    throw new Error("Promotion maximum discount must be positive.");
  }

  if (rule.discountKind === "PERCENTAGE") {
    if (
      !Number.isInteger(rule.percentageBps) ||
      (rule.percentageBps ?? 0) <= 0 ||
      (rule.percentageBps ?? 0) > 10_000
    ) {
      throw new Error(
        "Percentage promotion must be between 1 and 10000 basis points.",
      );
    }

    if (rule.fixedAmountMinor !== null && rule.fixedAmountMinor !== undefined) {
      throw new Error("Percentage promotion cannot also define a fixed amount.");
    }
    return;
  }

  if (
    rule.fixedAmountMinor === null ||
    rule.fixedAmountMinor === undefined ||
    rule.fixedAmountMinor <= 0n
  ) {
    throw new Error("Fixed promotion must define a positive amount.");
  }

  if (rule.percentageBps !== null && rule.percentageBps !== undefined) {
    throw new Error("Fixed promotion cannot also define a percentage.");
  }

  if (!rule.currency) {
    throw new Error("Fixed promotion must define a currency.");
  }

  assertCurrency(rule.currency);

  if (rule.currency !== context.currency) {
    throw new Error("Promotion currency does not match the quote currency.");
  }
}

export function calculatePromotionDiscount(
  rule: PromotionRule,
  context: PromotionContext,
): PromotionDiscount {
  assertPromotionEligible(rule, context);

  let discountMinor: bigint;

  if (rule.discountKind === "PERCENTAGE") {
    discountMinor =
      (context.subtotalMinor * BigInt(rule.percentageBps!)) / 10_000n;
  } else {
    discountMinor = rule.fixedAmountMinor!;
  }

  if (
    rule.maxDiscountMinor !== null &&
    rule.maxDiscountMinor !== undefined &&
    discountMinor > rule.maxDiscountMinor
  ) {
    discountMinor = rule.maxDiscountMinor;
  }

  if (discountMinor > context.subtotalMinor) {
    discountMinor = context.subtotalMinor;
  }

  return {
    discountMinor,
    payableBeforeTaxMinor: context.subtotalMinor - discountMinor,
  };
}
