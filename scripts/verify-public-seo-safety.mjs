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

for (const file of [
  "apps/web/src/app/admin/layout.tsx",
  "apps/web/src/app/account/layout.tsx",
  "apps/web/src/app/booking/layout.tsx",
  "apps/web/src/app/checkout/layout.tsx",
  "apps/web/src/app/payment/layout.tsx",
  "apps/web/src/app/my-trips/layout.tsx",
  "apps/web/src/app/custom-trip/layout.tsx",
  "apps/web/src/app/cars/search/layout.tsx",
]) {
  requireFragments(
    file,
    ["robots:", "index: false", "follow: false"],
    `${file} private-route metadata`,
  );
}

requireFragments(
  "apps/web/src/app/robots.ts",
  [
    '"/admin/"',
    '"/api/"',
    '"/booking/"',
    '"/checkout"',
    '"/payment"',
    '"/my-trips"',
    '"/custom-trip"',
    '"/cars/search"',
  ],
  "robots private-route exclusions",
);

requireFragments(
  "apps/web/src/app/robots.ts",
  ['"OAI-SearchBot"', '"Googlebot"', '"Bingbot"'],
  "AI crawler access",
);

requireFragments(
  "apps/web/src/app/llms.txt/route.ts",
  ["# YATRA", "Tour packages", "Destinations", "Sitemap:"],
  "AI-readable site guide",
);

requireFragments(
  "apps/web/src/app/sitemap.ts",
  [
    "getPublicPackages",
    "getPublicDestinations",
    "getPublicBlogPosts",
    "getPublicFleet",
    "getPublicCmsPages",
    "robotsIndex",
  ],
  "dynamic public sitemap",
);

for (const file of [
  "apps/web/src/app/cars/[slug]/page.tsx",
  "apps/web/src/app/packages/[slug]/page.tsx",
  "apps/web/src/app/destinations/[slug]/page.tsx",
  "apps/web/src/app/travel-guides/[slug]/page.tsx",
]) {
  requireFragments(
    file,
    ["generateMetadata", "description:", "canonical:", "JsonLd", "breadcrumbSchema"],
    `${file} dynamic metadata and schema`,
  );
}

for (const file of [
  "apps/web/src/app/page.tsx",
  "apps/web/src/app/cars/page.tsx",
  "apps/web/src/app/packages/page.tsx",
  "apps/web/src/app/destinations/page.tsx",
  "apps/web/src/app/travel-guides/page.tsx",
  "apps/web/src/app/faq/page.tsx",
  "apps/web/src/app/contact/page.tsx",
  "apps/web/src/app/offers/page.tsx",
]) {
  requireFragments(
    file,
    ["alternates:", "canonical:", "description:"],
    `${file} canonical metadata`,
  );
}

requireFragments(
  "apps/web/src/app/layout.tsx",
  [
    "organizationSchema",
    "websiteSchema",
    "GOOGLE_SITE_VERIFICATION",
    "BING_SITE_VERIFICATION",
  ],
  "site entity and verification metadata",
);

requireFragments(
  "apps/web/src/app/faq/page.tsx",
  ['"FAQPage"', '"Question"', '"Answer"'],
  "FAQ structured data",
);

requireFragments(
  "apps/web/src/app/not-found.tsx",
  ['404 · PAGE NOT FOUND', 'href="/packages"', 'href="/cars"'],
  "public not-found recovery",
);

const sitemap = read("apps/web/src/app/sitemap.ts");
for (const forbidden of [
  "/admin",
  "/account",
  "/booking",
  "/checkout",
  "/payment",
  "/my-trips",
  "/cars/search",
]) {
  if (sitemap.includes(`"${forbidden}"`)) {
    throw new Error(
      `Private route must not be included in sitemap: ${forbidden}`,
    );
  }
}

process.stdout.write("PASS sitemap excludes private workflow routes\n");
process.stdout.write("Public SEO / privacy certification passed.\n");
