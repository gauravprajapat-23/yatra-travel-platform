import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBookingTransition,
  canTransitionBooking,
} from "./status-machine";

test("booking status machine allows the reviewed payment lifecycle", () => {
  assert.equal(canTransitionBooking("DRAFT", "PENDING_REVIEW"), true);
  assert.equal(
    canTransitionBooking("PENDING_REVIEW", "PENDING_PAYMENT"),
    true,
  );
  assert.equal(canTransitionBooking("PENDING_PAYMENT", "CONFIRMED"), true);
  assert.equal(canTransitionBooking("CONFIRMED", "DRIVER_ASSIGNED"), true);
  assert.equal(canTransitionBooking("DRIVER_ASSIGNED", "IN_PROGRESS"), true);
  assert.equal(canTransitionBooking("IN_PROGRESS", "COMPLETED"), true);
});

test("booking status machine rejects invalid reversal", () => {
  assert.equal(canTransitionBooking("COMPLETED", "IN_PROGRESS"), false);
  assert.throws(
    () => assertBookingTransition("COMPLETED", "IN_PROGRESS"),
    /Invalid booking transition/,
  );
});
