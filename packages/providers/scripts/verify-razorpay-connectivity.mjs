import { Buffer } from "node:buffer";

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();

if (!keyId || !keySecret || !webhookSecret) {
  throw new Error("Razorpay credentials are incomplete.");
}

const mode = keyId.startsWith("rzp_test_")
  ? "test"
  : keyId.startsWith("rzp_live_")
    ? "live"
    : null;

if (!mode) {
  throw new Error("Unsupported Razorpay key id format.");
}

const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

async function api(path, init = {}) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Razorpay API returned HTTP ${response.status}.`);
  }

  return body;
}

await api("/orders?count=1");
console.log(`Razorpay authentication: PASS (${mode} mode)`);

if (mode === "test") {
  const order = await api("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: 100,
      currency: "INR",
      receipt: `connectivity_${Date.now()}`.slice(0, 40),
      notes: {
        purpose: "YATRA test-mode connectivity drill",
      },
    }),
  });

  if (
    !order ||
    order.entity !== "order" ||
    order.amount !== 100 ||
    order.currency !== "INR"
  ) {
    throw new Error("Unexpected Razorpay test order response.");
  }

  console.log("Razorpay ₹1 test-order drill: PASS");
} else {
  console.log("Live credentials detected: mutation drill intentionally skipped.");
}
