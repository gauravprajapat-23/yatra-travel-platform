import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authRoots = [
  path.join(root, "apps/web/src/app/api/admin-auth"),
  path.join(root, "apps/web/src/app/api/customer-auth"),
];

function routeFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...routeFiles(absolute));
    else if (entry.isFile() && entry.name === "route.ts") files.push(absolute);
  }
  return files;
}

const files = authRoots.flatMap(routeFiles);
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  for (const forbidden of [
    "error.message",
    "deliveryError.message",
    "String(error)",
    "JSON.stringify(error)",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${relative} exposes raw runtime error detail: ${forbidden}`);
    }
  }
}

const helper = fs.readFileSync(
  path.join(root, "apps/web/src/lib/request-security.ts"),
  "utf8",
);
if (!helper.includes("safeErrorName") || !helper.includes("slice(0, 80)")) {
  throw new Error("Safe runtime error-name helper is missing or unbounded.");
}

for (const [name, relative, cookie] of [
  ["admin", "apps/web/src/lib/auth/session.ts", "__Host-yatra_session"],
  ["customer", "apps/web/src/lib/auth/customer-session.ts", "__Host-yatra_customer"],
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  for (const required of [cookie, "httpOnly: true", 'sameSite: "lax"', "secure:"]) {
    if (!source.includes(required)) {
      throw new Error(`${name} session cookie is missing safeguard: ${required}`);
    }
  }
}

console.log(`Auth runtime privacy verification passed for ${files.length} auth routes.`);
