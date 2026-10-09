import { spawnSync } from "node:child_process";

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function expectUsageFailure(label, script, args, expectedFragment) {
  const result = run(script, args);
  if (result.status !== 2) {
    throw new Error(
      `${label}: expected exit 2, got ${String(result.status)}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (!output.includes(expectedFragment)) {
    throw new Error(
      `${label}: expected output to contain ${JSON.stringify(expectedFragment)}\n${output}`,
    );
  }

  process.stdout.write(`PASS ${label}\n`);
}

expectUsageFailure(
  "runtime suite rejects non-HTTPS production URL",
  "scripts/certify-production-runtime.mjs",
  ["--url", "http://example.com", "--modes", "core"],
  "Usage:",
);

expectUsageFailure(
  "runtime suite rejects URL paths",
  "scripts/certify-production-runtime.mjs",
  ["--url", "https://example.com/app", "--modes", "core"],
  "Usage:",
);

expectUsageFailure(
  "runtime suite rejects full mixed with other modes",
  "scripts/certify-production-runtime.mjs",
  ["--url", "https://example.com", "--modes", "full,core"],
  'Mode "full" cannot be combined',
);

expectUsageFailure(
  "runtime suite rejects malformed expected commit",
  "scripts/certify-production-runtime.mjs",
  [
    "--url",
    "https://example.com",
    "--modes",
    "core",
    "--expect-commit",
    "not-a-sha",
  ],
  "Expected commit must be",
);

expectUsageFailure(
  "runtime suite requires payments mode for refunds",
  "scripts/certify-production-runtime.mjs",
  ["--url", "https://example.com", "--modes", "core", "--require-refunds"],
  "--require-refunds requires payments or full",
);

expectUsageFailure(
  "runtime suite requires customer mode for password reset",
  "scripts/certify-production-runtime.mjs",
  [
    "--url",
    "https://example.com",
    "--modes",
    "core",
    "--require-password-reset",
  ],
  "--require-password-reset requires customer or full",
);

expectUsageFailure(
  "runtime suite requires package mode for departures",
  "scripts/certify-production-runtime.mjs",
  [
    "--url",
    "https://example.com",
    "--modes",
    "core",
    "--require-departures",
  ],
  "--require-departures requires package or full",
);

expectUsageFailure(
  "direct verifier requires matching refund mode",
  "scripts/verify-production-readiness.mjs",
  ["--url", "https://example.com", "--mode", "core", "--require-refunds"],
  "--require-refunds requires payments or full",
);

expectUsageFailure(
  "direct verifier rejects malformed expected commit",
  "scripts/verify-production-readiness.mjs",
  [
    "--url",
    "https://example.com",
    "--mode",
    "core",
    "--expect-commit",
    "xyz",
  ],
  "Expected commit must be",
);

process.stdout.write("Production runtime input safety certification passed.\n");
