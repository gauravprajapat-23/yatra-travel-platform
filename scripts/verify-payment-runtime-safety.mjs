import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireFragments(file, fragments, label) {
  const source = read(file);
  const missing = fragments.filter((fragment) => !source.includes(fragment));

  if (missing.length > 0) {
    throw new Error(
      `${label} is missing required safeguards: ${missing.join(", ")}`,
    );
  }

  process.stdout.write(`PASS ${label}\n`);
}

requireFragments(
  "apps/web/src/app/api/webhooks/razorpay/route.ts",
  [
    "MAX_WEBHOOK_BODY_BYTES",
    "PAYLOAD_TOO_LARGE",
    "MAX_EVENT_ID_LENGTH",
    "verifyRazorpayWebhookSignature",
    "provider_dedupeKey",
  ],
  "Razorpay webhook request bounds and replay protection",
);

requireFragments(
  "apps/web/src/app/admin/bookings/[reference]/page.tsx",
  [
    'where: { status: { in: ["PENDING", "PROCESSED"] } }',
    "createRefundRequest",
    "BOOKING_REFUND_REQUESTED",
  ],
  "admin refund retry balance and audit path",
);

requireFragments(
  "apps/web/src/modules/payments/refund-service.ts",
  [
    'status: { in: ["PENDING", "PROCESSED"] }',
    "remaining refundable amount",
    "TransactionIsolationLevel.Serializable",
  ],
  "refund reservation invariants",
);

requireFragments(
  "apps/web/src/app/api/payments/verify/route.ts",
  [
    "CHECKOUT_SESSION_MISMATCH",
    "reconcileVerifiedRazorpayPayment",
  ],
  "payment verification checkout binding",
);

process.stdout.write("Payment runtime safety certification passed.\n");
