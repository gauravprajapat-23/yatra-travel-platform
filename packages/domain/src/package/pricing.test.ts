import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTravellerRange,
  calculatePackageBasePrice,
} from "./pricing";

test("per-person package pricing multiplies by travellers", () => {
  assert.deepEqual(
    calculatePackageBasePrice({
      mode: "PER_PERSON",
      amountMinor: 1000n,
      travellers: 3,
    }),
    {
      quantity: 3,
      subtotalMinor: 3000n,
    },
  );
});

test("per-vehicle package pricing requires vehicle count", () => {
  assert.throws(
    () =>
      calculatePackageBasePrice({
        mode: "PER_VEHICLE",
        amountMinor: 1000n,
        travellers: 4,
      }),
    /vehicle count/,
  );
});

test("group pricing uses one quantity and validates traveller bounds", () => {
  assert.equal(
    calculatePackageBasePrice({
      mode: "PER_GROUP",
      amountMinor: 5000n,
      travellers: 5,
    }).subtotalMinor,
    5000n,
  );

  assert.doesNotThrow(() =>
    assertTravellerRange({
      travellers: 5,
      minTravellers: 2,
      maxTravellers: 6,
    }),
  );
});
