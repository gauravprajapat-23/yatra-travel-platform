import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "apps/web/src/app/privacy-policy/page.tsx",
  "apps/web/src/app/terms/page.tsx",
  "apps/web/src/app/robots.ts",
  "apps/web/src/app/sitemap.ts",
  "apps/web/src/app/not-found.tsx",
  "apps/web/src/proxy.ts",
  "apps/web/public/icon.svg",
  "apps/web/src/components/consent-analytics.tsx",
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

const layout = fs.readFileSync(path.join(root, "apps/web/src/app/layout.tsx"), "utf8");
for (const required of ["openGraph", "twitter", "ConsentAnalytics"]) {
  if (!layout.includes(required)) {
    throw new Error("Root metadata/consent contract missing: " + required);
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
console.log("PASS social metadata, consent, HSTS and image optimization contracts");
