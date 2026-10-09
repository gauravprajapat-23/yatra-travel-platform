import { test, expect } from "@playwright/test";

test("payment order creation remains disabled in normal CI", async ({ request }) => {
  const response = await request.post("/api/payments/order", {
    headers: {
      "Idempotency-Key": "e2e-payment-disabled-0001",
    },
    data: {
      bookingType: "CAR",
      bookingReference: "YAT-E2EASSIGN",
    },
  });

  expect(response.status()).toBe(503);
  const body = (await response.json()) as {
    error?: { code?: string };
  };
  expect(body.error?.code).toBe("PAYMENT_WRITE_DISABLED");
});

test("payment verification rejects requests without checkout session before provider access", async ({
  request,
}) => {
  const response = await request.post("/api/payments/verify", {
    data: {
      paymentIntentId: "e2e-missing-intent",
      razorpay_payment_id: "pay_e2e_missing",
      razorpay_signature: "a".repeat(64),
    },
  });

  expect(response.status()).toBe(403);
  const body = (await response.json()) as {
    error?: { code?: string };
  };
  expect(body.error?.code).toBe("CHECKOUT_SESSION_REQUIRED");
});

test("payment order requires a valid idempotency key when writes are enabled", async ({
  request,
}) => {
  // Normal CI intentionally keeps PAYMENT_WRITE_ENABLED=false, so the write
  // gate must win before request validation and no provider call can occur.
  const response = await request.post("/api/payments/order", {
    data: {
      bookingType: "CAR",
      bookingReference: "YAT-E2EASSIGN",
    },
  });

  expect(response.status()).toBe(503);
});
