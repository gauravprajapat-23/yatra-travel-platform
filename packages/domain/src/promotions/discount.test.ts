import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPromotionEligible,
  calculatePromotionDiscount,
  type PromotionRule,
} from "./discount";

const baseRule: PromotionRule = {
  scope: "ALL",
  discountKind: "PERCENTAGE",
  percentageBps: 1_000,
  fixedAmountMinor: null,
  currency: null,
  minSubtotalMinor: null,
  maxDiscountMinor: null,
  activeFrom: null,
  activeTo: null,
  maxRedemptions: null,
  redeemedCount: 0,
};

test("percentage promotion uses integer basis points", () => {
  const result = calculatePromotionDiscount(baseRule, {
    bookingType: "CAR",
    subtotalMinor: 12_345n,
    currency: "INR",
  });

  assert.equal(result.discountMinor, 1_234n);
  assert.equal(result.payableBeforeTaxMinor, 11_111n);
});

test("percentage promotion respects maximum discount cap", () => {
  const result = calculatePromotionDiscount(
    { ...baseRule, percentageBps: 5_000, maxDiscountMinor: 2_000n },
    {
      bookingType: "PACKAGE",
      subtotalMinor: 10_000n,
      currency: "INR",
    },
  );

  assert.equal(result.discountMinor, 2_000n);
});

test("fixed promotion cannot reduce payable amount below zero", () => {
  const result = calculatePromotionDiscount(
    {
      ...baseRule,
      discountKind: "FIXED",
      percentageBps: null,
      fixedAmountMinor: 50_000n,
      currency: "INR",
    },
    {
      bookingType: "CAR",
      subtotalMinor: 12_000n,
      currency: "INR",
    },
  );

  assert.equal(result.discountMinor, 12_000n);
  assert.equal(result.payableBeforeTaxMinor, 0n);
});

test("fixed promotion rejects currency mismatch", () => {
  assert.throws(
    () =>
      calculatePromotionDiscount(
        {
          ...baseRule,
          discountKind: "FIXED",
          percentageBps: null,
          fixedAmountMinor: 1_000n,
          currency: "USD",
        },
        {
          bookingType: "CAR",
          subtotalMinor: 12_000n,
          currency: "INR",
        },
      ),
    /currency does not match/i,
  );
});

test("scope, minimum spend and validity windows are enforced", () => {
  assert.throws(
    () =>
      assertPromotionEligible(
        {
          ...baseRule,
          scope: "PACKAGE",
        },
        {
          bookingType: "CAR",
          subtotalMinor: 10_000n,
          currency: "INR",
        },
      ),
    /booking type/i,
  );

  assert.throws(
    () =>
      assertPromotionEligible(
        {
          ...baseRule,
          minSubtotalMinor: 20_000n,
        },
        {
          bookingType: "CAR",
          subtotalMinor: 10_000n,
          currency: "INR",
        },
      ),
    /minimum/i,
  );

  const at = new Date("2026-10-08T12:00:00.000Z");
  assert.throws(
    () =>
      assertPromotionEligible(
        {
          ...baseRule,
          activeFrom: new Date("2026-10-09T00:00:00.000Z"),
        },
        {
          bookingType: "CAR",
          subtotalMinor: 10_000n,
          currency: "INR",
          at,
        },
      ),
    /not active/i,
  );

  assert.throws(
    () =>
      assertPromotionEligible(
        {
          ...baseRule,
          activeTo: new Date("2026-10-08T12:00:00.000Z"),
        },
        {
          bookingType: "CAR",
          subtotalMinor: 10_000n,
          currency: "INR",
          at,
        },
      ),
    /expired/i,
  );
});

test("redemption limit is enforced", () => {
  assert.throws(
    () =>
      assertPromotionEligible(
        {
          ...baseRule,
          maxRedemptions: 10,
          redeemedCount: 10,
        },
        {
          bookingType: "CAR",
          subtotalMinor: 10_000n,
          currency: "INR",
        },
      ),
    /limit has been reached/i,
  );
});

test("promotion rule rejects mixed discount modes", () => {
  assert.throws(
    () =>
      assertPromotionEligible(
        {
          ...baseRule,
          fixedAmountMinor: 100n,
        },
        {
          bookingType: "CAR",
          subtotalMinor: 10_000n,
          currency: "INR",
        },
      ),
    /cannot also define a fixed amount/i,
  );
});
