import assert from "node:assert/strict";
import test from "node:test";
import {
  assertQuoteMoney,
  assertQuoteUsable,
  createPriceSnapshot,
} from "./quote-policy";

test("quote money requires an internally consistent total", () => {
  const money = {
    subtotalMinor: 10000n,
    discountMinor: 1000n,
    taxMinor: 500n,
    totalMinor: 9500n,
    currency: "INR",
  };

  assert.doesNotThrow(() => assertQuoteMoney(money));
  assert.deepEqual(createPriceSnapshot(money), {
    currency: "INR",
    subtotalMinor: "10000",
    discountMinor: "1000",
    taxMinor: "500",
    totalMinor: "9500",
  });
});

test("expired quote is rejected", () => {
  const now = new Date("2026-10-04T10:00:00.000Z");
  assert.throws(
    () =>
      assertQuoteUsable(
        {
          createdAt: new Date("2026-10-04T08:00:00.000Z"),
          expiresAt: new Date("2026-10-04T09:00:00.000Z"),
        },
        now,
      ),
    /expired/,
  );
});
