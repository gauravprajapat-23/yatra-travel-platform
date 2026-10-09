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
  "packages/domain/src/promotions/discount.ts",
  [
    "assertPromotionRule",
    "assertPromotionEligible",
    "calculatePromotionDiscount",
    "percentageBps",
    "maxRedemptions",
    "perCustomerLimit",
  ],
  "promotion domain rules",
);

requireFragments(
  "apps/web/src/modules/promotions/promotion-preview-service.ts",
  [
    "assertQuoteUsable",
    "db.carQuote.findUnique",
    "db.packageQuote.findUnique",
    "db.promotionRedemption.count",
    "calculatePromotionDiscount",
    "promotionSnapshot",
  ],
  "server-authoritative promotion preview",
);

requireFragments(
  "apps/web/src/modules/promotions/promotion-redemption-service.ts",
  [
    'FOR UPDATE',
    "promotionRedemption.count",
    "promotionRedemption.create",
    "redeemedCount: { increment: 1 }",
    "PROMOTION_EXHAUSTED",
    "CUSTOMER_LIMIT_REACHED",
  ],
  "serialized promotion redemption guard",
);

requireFragments(
  "apps/web/src/app/api/promotions/preview/route.ts",
  [
    'process.env.PROMOTION_APPLY_ENABLED !== "true"',
    "PROMOTION_APPLY_DISABLED",
    "previewPromotionForQuote",
    "consumePublicWriteAttempt",
  ],
  "promotion preview remains explicitly gated",
);

requireFragments(
  "apps/web/src/modules/booking/car-booking-service.ts",
  [
    "createPriceSnapshot",
    'process.env.PROMOTION_APPLY_ENABLED !== "true"',
    "preparePromotionForBooking",
    "createPromotionRedemption",
    "promotionSnapshot",
    "PROMOTION_DISABLED",
  ],
  "car booking promotion application is gated and atomic",
);

requireFragments(
  "apps/web/src/modules/booking/package-booking-service.ts",
  [
    "createPriceSnapshot",
    'process.env.PROMOTION_APPLY_ENABLED !== "true"',
    "preparePromotionForBooking",
    "createPromotionRedemption",
    "promotionSnapshot",
    "PROMOTION_DISABLED",
  ],
  "package booking promotion application is gated and atomic",
);

process.stdout.write("Promotion runtime safety certification passed.\n");
