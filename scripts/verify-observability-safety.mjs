import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const instrumentationPath = path.join(
  root,
  "apps/web/src/instrumentation.ts",
);
const boundaryPath = path.join(root, "apps/web/src/app/error.tsx");

const instrumentation = fs.readFileSync(instrumentationPath, "utf8");
const boundary = fs.readFileSync(boundaryPath, "utf8");

for (const required of [
  "Instrumentation.onRequestError",
  "safePath",
  "errorName",
  "digest",
  "routeType",
  "deploymentCommit",
  "console.error(JSON.stringify(event))",
]) {
  if (!instrumentation.includes(required)) {
    throw new Error(
      `Observability instrumentation is missing required safeguard: ${required}`,
    );
  }
}

for (const forbidden of [
  "error.message",
  "request.headers",
  "request.body",
  "request.url",
  "JSON.stringify(request)",
  "JSON.stringify(error)",
]) {
  if (instrumentation.includes(forbidden)) {
    throw new Error(
      `Observability instrumentation must not capture sensitive source: ${forbidden}`,
    );
  }
}

if (!instrumentation.includes('split("?")')) {
  throw new Error("Instrumentation must strip query strings from fallback paths.");
}

if (!boundary.includes("error.digest")) {
  throw new Error("Error boundary should expose only the safe framework digest.");
}

if (boundary.includes("error.message")) {
  throw new Error("Error boundary must not render raw error messages.");
}

console.log("Observability safety verification passed.");
