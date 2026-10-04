import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIdempotentReplay,
  createBookingRequestFingerprint,
} from "./idempotency";

test("booking fingerprint is stable across harmless casing and whitespace", () => {
  const a = createBookingRequestFingerprint({
    quoteId: "quote-1",
    guestName: " Gaurav ",
    guestEmail: "USER@EXAMPLE.COM",
  });
  const b = createBookingRequestFingerprint({
    quoteId: "quote-1",
    guestName: "gaurav",
    guestEmail: "user@example.com",
  });

  assert.equal(a, b);
});

test("idempotency replay rejects changed request", () => {
  assert.throws(
    () => assertIdempotentReplay("one", "two"),
    /different booking request/,
  );
});
