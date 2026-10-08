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
  "apps/web/src/app/api/bookings/car/route.ts",
  [
    "getCustomerSession",
    "customerUserId: customerSession.userId",
    "INVALID_GUEST_NAME",
    "INVALID_GUEST_EMAIL",
  ],
  "car booking derives customer ownership from signed session",
);

requireFragments(
  "apps/web/src/app/api/bookings/package/route.ts",
  [
    "getCustomerSession",
    "customerUserId: customerSession.userId",
    "INVALID_GUEST_NAME",
    "INVALID_GUEST_EMAIL",
  ],
  "package booking derives customer ownership from signed session",
);

for (const file of [
  "apps/web/src/modules/booking/car-booking-service.ts",
  "apps/web/src/modules/booking/package-booking-service.ts",
]) {
  requireFragments(
    file,
    [
      "createCustomerBookingRequestFingerprint",
      "customerUserId",
      "guestName: customerUserId ? null",
      "guestEmail: customerUserId",
    ],
    `${file} stores mutually exclusive customer/guest identity`,
  );
}

requireFragments(
  "apps/web/src/lib/auth/customer-session.ts",
  [
    "customer-session:",
    "CUSTOMER_SESSION_COOKIE",
    'hasPermission(roles, "customer.self.read")',
    "emailVerifiedAt",
  ],
  "customer session isolation and verified-role checks",
);

process.stdout.write("Customer auth/booking ownership certification passed.\n");
