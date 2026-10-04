import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "./razorpay-signature";

test("verifies Razorpay webhook HMAC against raw body", () => {
  const secret = "test-secret";
  const rawBody = JSON.stringify({ event: "payment.captured" });
  const signature = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  assert.equal(
    verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      webhookSecret: secret,
    }),
    true,
  );
});

test("rejects changed webhook body", () => {
  const secret = "test-secret";
  const signature = createHmac("sha256", secret)
    .update("original")
    .digest("hex");

  assert.equal(
    verifyRazorpayWebhookSignature({
      rawBody: "changed",
      signature,
      webhookSecret: secret,
    }),
    false,
  );
});

test("verifies payment callback signature using trusted order id", () => {
  const keySecret = "key-secret";
  const orderId = "order_123";
  const paymentId = "pay_456";
  const signature = createHmac("sha256", keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  assert.equal(
    verifyRazorpayPaymentSignature({
      orderId,
      paymentId,
      signature,
      keySecret,
    }),
    true,
  );
});
