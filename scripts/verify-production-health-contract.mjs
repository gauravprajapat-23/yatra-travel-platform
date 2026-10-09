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
  "apps/web/src/app/api/health/launch/route.ts",
  [
    "customerAuthWriteEnabled",
    "customerPasswordResetEnabled",
    "notificationEmailProviderConfigured",
    "promotionApplyEnabled",
    "activePromotions",
    "openPackageDepartures",
    "fleetComplianceBlockers",
    "customerAuthReady",
    "passwordResetReady",
    "promotionReady",
    "packageDepartureReady",
    "fleetComplianceReady",
    "crmReady",
    '"Cache-Control": "no-store"',
  ],
  "modern launch health contract",
);

requireFragments(
  "scripts/verify-production-readiness.mjs",
  [
    '"customer"',
    '"notifications"',
    '"promotions"',
    '"fleet"',
    '"crm"',
    "--require-password-reset",
    "--require-departures",
    "expected deployment revision",
  ],
  "production readiness CLI capabilities",
);

const healthSource = read("apps/web/src/app/api/health/launch/route.ts");
for (const forbidden of [
  "RAZORPAY_KEY_SECRET:",
  "RAZORPAY_WEBHOOK_SECRET:",
  "RESEND_API_KEY:",
  "FIELD_ENCRYPTION_KEY:",
  "AUTH_SECRET:",
]) {
  if (healthSource.includes(forbidden)) {
    throw new Error(
      `Launch health must not serialize secret field ${forbidden}`,
    );
  }
}

process.stdout.write("PASS launch health does not serialize secret fields\n");
process.stdout.write("Production readiness contract verification passed.\n");
