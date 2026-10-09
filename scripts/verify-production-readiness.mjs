#!/usr/bin/env node

const args = process.argv.slice(2);

function value(flag, fallback = "") {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function has(flag) {
  return args.includes(flag);
}

const rawBaseUrl =
  value("--url") ||
  process.env.PRODUCTION_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "";

function normalizeBaseUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.search || parsed.hash) return null;
  if (parsed.pathname !== "/" && parsed.pathname !== "") return null;

  const local =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  if (!local && parsed.protocol !== "https:") return null;

  return parsed.origin;
}

const baseUrl = normalizeBaseUrl(rawBaseUrl);

const mode = value("--mode", "core").toLowerCase();
const expectedCommit = value("--expect-commit").trim().toLowerCase();

const allowedModes = new Set([
  "core",
  "car",
  "package",
  "payments",
  "media",
  "scheduled",
  "customer",
  "notifications",
  "promotions",
  "fleet",
  "crm",
  "full",
]);

if (!baseUrl) {
  console.error(
    "Usage: node scripts/verify-production-readiness.mjs --url https://example.com [--mode core|car|package|payments|media|scheduled|customer|notifications|promotions|fleet|crm|full]",
  );
  process.exit(2);
}

if (!allowedModes.has(mode)) {
  console.error(`Unknown readiness mode: ${mode}`);
  process.exit(2);
}

if (
  expectedCommit &&
  !/^[0-9a-f]{7,40}$/i.test(expectedCommit)
) {
  console.error(
    "Expected commit must be a 7–40 character hexadecimal Git SHA or prefix.",
  );
  process.exit(2);
}

if (
  has("--require-refunds") &&
  !["payments", "full"].includes(mode)
) {
  console.error("--require-refunds requires payments or full mode.");
  process.exit(2);
}

if (
  has("--require-password-reset") &&
  !["customer", "full"].includes(mode)
) {
  console.error(
    "--require-password-reset requires customer or full mode.",
  );
  process.exit(2);
}

if (
  has("--require-departures") &&
  !["package", "full"].includes(mode)
) {
  console.error("--require-departures requires package or full mode.");
  process.exit(2);
}

const healthUrl = `${baseUrl}/api/health/launch`;

let response;
try {
  response = await fetch(healthUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      "user-agent": "yatra-production-readiness/1.0",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
} catch (error) {
  console.error(
    `FAIL unable to reach ${healthUrl}: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

let health;
try {
  health = await response.json();
} catch {
  console.error(
    `FAIL ${healthUrl} did not return JSON (HTTP ${response.status}).`,
  );
  process.exit(1);
}

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), detail });
}

check(
  "health endpoint HTTP status",
  response.ok,
  `HTTP ${response.status}`,
);

if (expectedCommit) {
  const actualCommit =
    typeof health.deploymentCommit === "string"
      ? health.deploymentCommit.toLowerCase()
      : "";

  check(
    "expected deployment revision",
    Boolean(actualCommit) &&
      (actualCommit.startsWith(expectedCommit) ||
        expectedCommit.startsWith(actualCommit)),
    actualCommit || "not exposed",
  );
}
check(
  "database configured",
  health.databaseConfigured === true,
  String(health.databaseConfigured),
);
check(
  "database reachable",
  health.databaseReachable === true,
  String(health.databaseReachable),
);
check(
  "application URL configured",
  health.appUrlConfigured === true,
  String(health.appUrlConfigured),
);
check(
  "checkout signing configured",
  health.checkoutSessionSigningConfigured === true,
  String(health.checkoutSessionSigningConfigured),
);
check(
  "field encryption configured",
  health.fieldEncryptionConfigured === true,
  String(health.fieldEncryptionConfigured),
);
check(
  "legal pages published",
  health.legalReady === true,
  `${health.requiredLegalPagesPublished ?? "?"}/3`,
);
check(
  "lead forms ready",
  health.leadFormsReady === true,
  String(health.leadFormsReady),
);

if (["car", "full"].includes(mode)) {
  check(
    "active vehicles available",
    Number(health.activeVehicles) > 0,
    String(health.activeVehicles),
  );
  check(
    "active pricing rules available",
    Number(health.activePricingRules) > 0,
    String(health.activePricingRules),
  );
  check(
    "active car booking policy available",
    Number(health.activeCarBookingPolicies) > 0,
    String(health.activeCarBookingPolicies),
  );
  check(
    "car booking writes enabled",
    health.bookingWriteEnabled === true,
    String(health.bookingWriteEnabled),
  );
  check(
    "car booking ready",
    health.carBookingReady === true,
    String(health.carBookingReady),
  );
}

if (["package", "full"].includes(mode)) {
  check(
    "active package booking policy available",
    Number(health.activePackageBookingPolicies) > 0,
    String(health.activePackageBookingPolicies),
  );
  check(
    "package booking writes enabled",
    health.packageBookingWriteEnabled === true,
    String(health.packageBookingWriteEnabled),
  );
  check(
    "package booking ready",
    health.packageBookingReady === true,
    String(health.packageBookingReady),
  );
}

if (["customer", "full"].includes(mode)) {
  check(
    "customer auth writes enabled",
    health.customerAuthWriteEnabled === true,
    String(health.customerAuthWriteEnabled),
  );
  check(
    "email notification provider configured",
    health.notificationEmailProviderConfigured === true,
    String(health.notificationEmailProviderConfigured),
  );
  check(
    "customer authentication ready",
    health.customerAuthReady === true,
    String(health.customerAuthReady),
  );

  if (has("--require-password-reset")) {
    check(
      "password reset enabled",
      health.customerPasswordResetEnabled === true,
      String(health.customerPasswordResetEnabled),
    );
    check(
      "password reset ready",
      health.passwordResetReady === true,
      String(health.passwordResetReady),
    );
  }
}

if (["notifications", "full"].includes(mode)) {
  check(
    "email notification provider configured",
    health.notificationEmailProviderConfigured === true,
    String(health.notificationEmailProviderConfigured),
  );
}

if (["promotions", "full"].includes(mode)) {
  check(
    "promotion application enabled",
    health.promotionApplyEnabled === true,
    String(health.promotionApplyEnabled),
  );
  check(
    "active promotions available",
    Number(health.activePromotions) > 0,
    String(health.activePromotions),
  );
  check(
    "promotion flow ready",
    health.promotionReady === true,
    String(health.promotionReady),
  );
}

if (["fleet", "full"].includes(mode)) {
  check(
    "no expired dispatch-blocking fleet documents",
    Number(health.fleetComplianceBlockers) === 0,
    String(health.fleetComplianceBlockers),
  );
  check(
    "fleet compliance ready",
    health.fleetComplianceReady === true,
    String(health.fleetComplianceReady),
  );
}

if (["crm", "full"].includes(mode)) {
  check(
    "CRM tables ready",
    health.crmReady === true,
    String(health.crmReady),
  );
}

if (["package", "full"].includes(mode) && has("--require-departures")) {
  check(
    "sellable package departures available",
    Number(health.openPackageDepartures) > 0,
    String(health.openPackageDepartures),
  );
  check(
    "package departure inventory ready",
    health.packageDepartureReady === true,
    String(health.packageDepartureReady),
  );
}

if (["payments", "full"].includes(mode)) {
  check(
    "Razorpay configured",
    health.razorpayConfigured === true,
    String(health.razorpayConfigured),
  );
  check(
    "payment writes enabled",
    health.paymentWriteEnabled === true,
    String(health.paymentWriteEnabled),
  );

  if (mode === "payments") {
    check(
      "at least one payment channel ready",
      health.paymentReady === true,
      `car=${String(health.carPaymentReady)} package=${String(health.packagePaymentReady)}`,
    );
  }

  if (mode === "full") {
    check(
      "all booking channels ready",
      health.fullBookingReady === true,
      String(health.fullBookingReady),
    );
    check(
      "car payment channel ready",
      health.carPaymentReady === true,
      String(health.carPaymentReady),
    );
    check(
      "package payment channel ready",
      health.packagePaymentReady === true,
      String(health.packagePaymentReady),
    );
    check(
      "all payment channels ready",
      health.fullPaymentReady === true,
      String(health.fullPaymentReady),
    );
  }

  if (has("--require-refunds") || mode === "full") {
    check(
      "refund flow ready",
      health.refundReady === true,
      `write=${String(health.refundWriteEnabled)} provider=${String(health.razorpayConfigured)}`,
    );
  }
}

if (["media", "full"].includes(mode)) {
  check(
    "storage configured",
    health.storageConfigured === true,
    String(health.storageConfigured),
  );
  check(
    "media writes enabled",
    health.mediaWriteEnabled === true,
    String(health.mediaWriteEnabled),
  );
  check(
    "media flow ready",
    health.mediaReady === true,
    String(health.mediaReady),
  );
}

if (["scheduled", "full"].includes(mode)) {
  check(
    "scheduled publisher configured",
    health.scheduledPublisherConfigured === true,
    String(health.scheduledPublisherConfigured),
  );
  check(
    "scheduled publisher recently ran",
    health.scheduledPublisherRecentlyRan === true,
    health.scheduledPublisherLastRunAt ?? "never",
  );
}

console.log(`YATRA production readiness: ${baseUrl}`);
console.log(`Mode: ${mode}`);
console.log("");

for (const item of checks) {
  console.log(
    `${item.pass ? "PASS" : "FAIL"}  ${item.name} (${item.detail})`,
  );
}

const failures = checks.filter((item) => !item.pass);

console.log("");
if (failures.length > 0) {
  console.error(
    `NOT READY: ${failures.length} readiness check${failures.length === 1 ? "" : "s"} failed.`,
  );
  process.exit(1);
}

console.log(`READY: all ${checks.length} checks passed.`);
