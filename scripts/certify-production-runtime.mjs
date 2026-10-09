#!/usr/bin/env node

import { spawnSync } from "node:child_process";

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

const expectedCommit = value("--expect-commit").trim();
const rawModes = value("--modes", "core");
const modes = [
  ...new Set(
    rawModes
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ),
];

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
    "Usage: node scripts/certify-production-runtime.mjs --url https://example.com --modes core,car,fleet [--expect-commit <sha>]",
  );
  process.exit(2);
}

if (modes.length === 0) {
  console.error("At least one readiness mode is required.");
  process.exit(2);
}

for (const mode of modes) {
  if (!allowedModes.has(mode)) {
    console.error(`Unknown readiness mode: ${mode}`);
    process.exit(2);
  }
}

if (modes.includes("full") && modes.length > 1) {
  console.error('Mode "full" cannot be combined with other modes.');
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
  !modes.some((mode) => ["payments", "full"].includes(mode))
) {
  console.error(
    "--require-refunds requires payments or full readiness mode.",
  );
  process.exit(2);
}

if (
  has("--require-password-reset") &&
  !modes.some((mode) => ["customer", "full"].includes(mode))
) {
  console.error(
    "--require-password-reset requires customer or full readiness mode.",
  );
  process.exit(2);
}

if (
  has("--require-departures") &&
  !modes.some((mode) => ["package", "full"].includes(mode))
) {
  console.error(
    "--require-departures requires package or full readiness mode.",
  );
  process.exit(2);
}

const sharedFlags = [];
if (expectedCommit) {
  sharedFlags.push("--expect-commit", expectedCommit);
}
if (has("--require-refunds")) sharedFlags.push("--require-refunds");
if (has("--require-password-reset")) {
  sharedFlags.push("--require-password-reset");
}
if (has("--require-departures")) sharedFlags.push("--require-departures");

console.log(`YATRA runtime certification suite: ${baseUrl}`);
console.log(`Modes: ${modes.join(", ")}`);
if (expectedCommit) {
  console.log(`Expected commit: ${expectedCommit}`);
}
console.log("");

const failures = [];

for (const mode of modes) {
  console.log(`=== Readiness mode: ${mode} ===`);

  const result = spawnSync(
    process.execPath,
    [
      "scripts/verify-production-readiness.mjs",
      "--url",
      baseUrl,
      "--mode",
      mode,
      ...sharedFlags,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    failures.push(mode);
  }

  console.log("");
}

if (failures.length > 0) {
  console.error(
    `RUNTIME CERTIFICATION FAILED: ${failures.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  `RUNTIME CERTIFICATION PASSED: ${modes.join(", ")}`,
);
