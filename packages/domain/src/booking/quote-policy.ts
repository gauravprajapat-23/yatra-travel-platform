export type QuoteMoney = {
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  currency: string;
};

export type QuoteLifecycle = {
  createdAt: Date;
  expiresAt: Date;
};

export function assertQuoteMoney(money: QuoteMoney): void {
  for (const [field, value] of Object.entries(money)) {
    if (field === "currency") continue;
    if (typeof value === "bigint" && value < 0n) {
      throw new Error(`${field} cannot be negative.`);
    }
  }

  if (!/^[A-Z]{3}$/.test(money.currency)) {
    throw new Error("Currency must be a three-letter uppercase code.");
  }

  const expected =
    money.subtotalMinor - money.discountMinor + money.taxMinor;

  if (expected !== money.totalMinor) {
    throw new Error("Quote total does not match its money components.");
  }
}

export function assertQuoteUsable(
  lifecycle: QuoteLifecycle,
  now = new Date(),
): void {
  if (lifecycle.createdAt >= lifecycle.expiresAt) {
    throw new Error("Quote expiry must be after quote creation.");
  }

  if (now >= lifecycle.expiresAt) {
    throw new Error("Quote has expired.");
  }
}

export function createPriceSnapshot(money: QuoteMoney) {
  assertQuoteMoney(money);

  return {
    currency: money.currency,
    subtotalMinor: money.subtotalMinor.toString(),
    discountMinor: money.discountMinor.toString(),
    taxMinor: money.taxMinor.toString(),
    totalMinor: money.totalMinor.toString(),
  } as const;
}
