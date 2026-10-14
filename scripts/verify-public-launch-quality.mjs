import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "apps/web/src/app/privacy-policy/page.tsx",
  "apps/web/src/app/terms/page.tsx",
  "apps/web/src/app/robots.ts",
  "apps/web/src/app/sitemap.ts",
  "apps/web/src/app/llms.txt/route.ts",
  "apps/web/src/app/not-found.tsx",
  "apps/web/src/proxy.ts",
  "apps/web/public/icon.svg",
  "apps/web/src/components/consent-analytics.tsx",
  "apps/web/src/components/seo-json-ld.tsx",
];

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error("Missing launch-critical file: " + relative);
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const assetDir = path.join(root, "apps/web/public/assets");
const assets = walk(assetDir);
let totalBytes = 0;

for (const file of assets) {
  const size = fs.statSync(file).size;
  totalBytes += size;
  if (size > 250 * 1024) {
    throw new Error("Public asset exceeds 250KB performance budget: " + path.relative(root, file) + " (" + size + " bytes)");
  }
}

if (totalBytes > 2 * 1024 * 1024) {
  throw new Error("Public asset bundle exceeds 2MB performance budget: " + totalBytes + " bytes");
}

const sourceDir = path.join(root, "apps/web/src");
const sourceFiles = walk(sourceDir).filter((file) => file.endsWith(".tsx"));
const missingAlt = [];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  const tags = content.match(/<img\b[\s\S]*?>/g) ?? [];
  for (const tag of tags) {
    if (!/\balt\s*=/.test(tag)) {
      missingAlt.push(path.relative(root, file) + ": " + tag.slice(0, 120));
    }
  }
}

if (missingAlt.length) {
  throw new Error("Image elements missing alt text:\n" + missingAlt.join("\n"));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

const appDir = path.join(root, "apps/web/src/app");
const routePatterns = walk(appDir)
  .filter((file) => file.endsWith(path.sep + "page.tsx"))
  .map((file) => {
    const relativeDir = path.relative(appDir, path.dirname(file));
    const segments = relativeDir === "."
      ? []
      : relativeDir.split(path.sep).filter((segment) => !/^\(.+\)$/.test(segment));

    const pattern = segments.map((segment) => {
      if (/^\[\.\.\..+\]$/.test(segment)) return ".+";
      if (/^\[\[\.\.\..+\]\]$/.test(segment)) return ".*";
      if (/^\[[^\]]+\]$/.test(segment)) return "[^/]+";
      return escapeRegex(segment);
    }).join("/");

    return new RegExp("^/" + pattern + "/?$");
  });

const brokenLinks = [];
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  const matches = content.matchAll(/(?:href|primaryHref)\s*=\s*["\'](\/[^"\'#?]*)[^"\']*["\']/g);
  for (const match of matches) {
    const href = match[1] || "/";
    if (href.startsWith("/api/") || href.startsWith("/_next/") || href.startsWith("/assets/")) continue;
    if (!routePatterns.some((pattern) => pattern.test(href))) {
      brokenLinks.push(path.relative(root, file) + " -> " + href);
    }
  }
}

if (brokenLinks.length) {
  throw new Error("Broken static internal links:\n" + brokenLinks.join("\n"));
}

const layout = fs.readFileSync(path.join(root, "apps/web/src/app/layout.tsx"), "utf8");
for (const required of ["openGraph", "twitter", "ConsentAnalytics", "organizationSchema", "websiteSchema"]) {
  if (!layout.includes(required)) {
    throw new Error("Root metadata/consent/structured-data contract missing: " + required);
  }
}

const robots = fs.readFileSync(path.join(root, "apps/web/src/app/robots.ts"), "utf8");
for (const crawler of ["Googlebot", "Bingbot", "OAI-SearchBot"]) {
  if (!robots.includes(crawler)) {
    throw new Error("Search crawler access is not explicit for " + crawler);
  }
}

const nextConfig = fs.readFileSync(path.join(root, "apps/web/next.config.ts"), "utf8");
if (!nextConfig.includes("Strict-Transport-Security")) {
  throw new Error("HSTS header is missing.");
}
if (!nextConfig.includes('formats: ["image/avif", "image/webp"]')) {
  throw new Error("Modern image format configuration is missing.");
}

console.log("PASS launch-critical files:", requiredFiles.length);
console.log("PASS public asset count:", assets.length);
console.log("PASS public asset bytes:", totalBytes);
console.log("PASS image alt audit:", sourceFiles.length, "TSX files");
console.log("PASS static internal-link audit:", routePatterns.length, "routes");
console.log("PASS search and AI crawler access");
console.log("PASS social metadata, consent, structured data, HSTS and image optimization contracts");
