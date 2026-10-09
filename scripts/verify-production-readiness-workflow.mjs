import fs from "node:fs";

const workflow = fs.readFileSync(
  ".github/workflows/production-readiness.yml",
  "utf8",
);

const required = [
  "modes:",
  "require_refunds:",
  "require_password_reset:",
  "require_departures:",
  'args=(--url "$PRODUCTION_URL" --modes "$READINESS_MODES")',
  'args+=(--expect-commit "$EXPECTED_COMMIT")',
  'args+=(--require-refunds)',
  'args+=(--require-password-reset)',
  'args+=(--require-departures)',
  'npm run certify:production-runtime -- "${args[@]}"',
];

const missing = required.filter((fragment) => !workflow.includes(fragment));
if (missing.length > 0) {
  throw new Error(
    `Production readiness workflow is missing modern runtime wiring: ${missing.join(", ")}`,
  );
}

if (workflow.includes("npm run verify:production --")) {
  throw new Error(
    "Production readiness workflow must use certify:production-runtime, not the legacy single-mode command.",
  );
}

console.log("Production readiness workflow certification passed.");
