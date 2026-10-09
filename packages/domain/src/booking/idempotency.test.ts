import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIdempotentReplay,
  createBookingRequestFingerprint,
  createCustomerBookingRequestFingerprint,
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


test("customer booking fingerprint is stable for the same quote and customer", () => {
  const a = createCustomerBookingRequestFingerprint({
    quoteId: " quote-1 ",
    customerUserId: "customer-123",
  });
  const b = createCustomerBookingRequestFingerprint({
    quoteId: "quote-1",
    customerUserId: "customer-123",
  });

  assert.equal(a, b);
});

test("customer booking fingerprint changes when customer ownership changes", () => {
  const a = createCustomerBookingRequestFingerprint({
    quoteId: "quote-1",
    customerUserId: "customer-123",
  });
  const b = createCustomerBookingRequestFingerprint({
    quoteId: "quote-1",
    customerUserId: "customer-456",
  });

  assert.notEqual(a, b);
});

test("booking fingerprint normalizes promotion code casing", () => {
  const a = createBookingRequestFingerprint({
    quoteId: "quote-1",
    guestName: "Gaurav",
    guestEmail: "user@example.com",
    promotionCode: " yatra10 ",
  });
  const b = createBookingRequestFingerprint({
    quoteId: "quote-1",
    guestName: "Gaurav",
    guestEmail: "user@example.com",
    promotionCode: "YATRA10",
  });

  assert.equal(a, b);
});

test("booking fingerprint changes when promotion code changes", () => {
  const a = createBookingRequestFingerprint({
    quoteId: "quote-1",
    guestName: "Gaurav",
    guestEmail: "user@example.com",
    promotionCode: "YATRA10",
  });
  const b = createBookingRequestFingerprint({
    quoteId: "quote-1",
    guestName: "Gaurav",
    guestEmail: "user@example.com",
    promotionCode: "YATRA20",
  });

  assert.notEqual(a, b);
});

test("customer booking fingerprint changes when promotion changes", () => {
  const a = createCustomerBookingRequestFingerprint({
    quoteId: "quote-1",
    customerUserId: "customer-123",
    promotionCode: "YATRA10",
  });
  const b = createCustomerBookingRequestFingerprint({
    quoteId: "quote-1",
    customerUserId: "customer-123",
    promotionCode: null,
  });

  assert.notEqual(a, b);
});
