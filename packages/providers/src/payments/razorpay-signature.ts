import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

function constantTimeEqual(expectedHex: string, receivedHex: string): boolean {
  if (!/^[a-f0-9]+$/i.test(receivedHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string | Buffer;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!input.webhookSecret) {
    throw new Error("Razorpay webhook secret is required.");
  }

  const expected = createHmac("sha256", input.webhookSecret)
    .update(input.rawBody)
    .digest("hex");

  return constantTimeEqual(expected, input.signature.trim());
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!input.keySecret) {
    throw new Error("Razorpay key secret is required.");
  }

  const expected = createHmac("sha256", input.keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return constantTimeEqual(expected, input.signature.trim());
}
