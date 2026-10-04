import assert from "node:assert/strict";
import test from "node:test";
import {
  createPolicySnapshot,
  selectActiveBookingPolicy,
} from "./booking-policy";

test("selects one effective active booking policy", () => {
  const now = new Date("2026-10-04T10:00:00.000Z");
  const selected = selectActiveBookingPolicy(
    [
      {
        id: "policy-1",
        code: "CAR_BOOKING",
        version: 1,
        status: "ACTIVE",
        effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
        effectiveTo: null,
        document: { cancellation: { configured: true } },
      },
    ],
    "CAR_BOOKING",
    now,
  );

  assert.equal(selected?.id, "policy-1");
  assert.equal(createPolicySnapshot(selected!).version, 1);
});

test("returns null when no active policy exists", () => {
  const selected = selectActiveBookingPolicy(
    [
      {
        id: "draft",
        code: "CAR_BOOKING",
        version: 1,
        status: "DRAFT",
        effectiveFrom: null,
        effectiveTo: null,
        document: {},
      },
    ],
    "CAR_BOOKING",
  );

  assert.equal(selected, null);
});
