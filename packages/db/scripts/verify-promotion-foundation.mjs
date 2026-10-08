import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

await client.connect();

try {
  const expectedTables = ["Promotion", "PromotionRedemption"];
  const tables = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [expectedTables],
  );

  const foundTables = new Set(tables.rows.map((row) => row.tablename));
  const missingTables = expectedTables.filter(
    (table) => !foundTables.has(table),
  );
  if (missingTables.length) {
    throw new Error(
      `Missing promotion tables: ${missingTables.join(", ")}`,
    );
  }

  const columnRows = await client.query(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
        AND column_name = ANY($2::text[])
    `,
    [
      ["CarQuote", "CarBooking", "PackageQuote", "PackageBooking"],
      ["promotionId", "promotionSnapshot"],
    ],
  );

  const columnKeys = new Set(
    columnRows.rows.map(
      (row) => `${row.table_name}.${row.column_name}`,
    ),
  );

  for (const table of [
    "CarQuote",
    "CarBooking",
    "PackageQuote",
    "PackageBooking",
  ]) {
    for (const column of ["promotionId", "promotionSnapshot"]) {
      const key = `${table}.${column}`;
      if (!columnKeys.has(key)) {
        throw new Error(`Missing promotion quote/booking column: ${key}`);
      }
    }
  }

  const promotionChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"Promotion"'::regclass
        AND contype = 'c'
    `,
  );
  const promotionCheckNames = new Set(
    promotionChecks.rows.map((row) => row.conname),
  );

  for (const expected of [
    "Promotion_code_format_check",
    "Promotion_discount_mode_check",
    "Promotion_currency_format_check",
    "Promotion_min_subtotal_check",
    "Promotion_max_discount_check",
    "Promotion_max_redemptions_check",
    "Promotion_redeemed_count_check",
    "Promotion_per_customer_limit_check",
    "Promotion_active_window_check",
  ]) {
    if (!promotionCheckNames.has(expected)) {
      throw new Error(`Missing Promotion constraint: ${expected}`);
    }
  }

  const redemptionChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"PromotionRedemption"'::regclass
        AND contype = 'c'
    `,
  );
  const redemptionCheckNames = new Set(
    redemptionChecks.rows.map((row) => row.conname),
  );

  for (const expected of [
    "PromotionRedemption_booking_identity_check",
    "PromotionRedemption_customer_identity_check",
    "PromotionRedemption_guest_email_normalized_check",
    "PromotionRedemption_currency_format_check",
    "PromotionRedemption_discount_check",
  ]) {
    if (!redemptionCheckNames.has(expected)) {
      throw new Error(
        `Missing PromotionRedemption constraint: ${expected}`,
      );
    }
  }

  const uniqueIndexes = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
    `,
    [[
      "Promotion_code_key",
      "PromotionRedemption_carBookingId_key",
      "PromotionRedemption_packageBookingId_key",
    ]],
  );
  const uniqueNames = new Set(
    uniqueIndexes.rows.map((row) => row.indexname),
  );

  for (const expected of [
    "Promotion_code_key",
    "PromotionRedemption_carBookingId_key",
    "PromotionRedemption_packageBookingId_key",
  ]) {
    if (!uniqueNames.has(expected)) {
      throw new Error(`Missing promotion uniqueness index: ${expected}`);
    }
  }

  console.log("Promotion foundation verification passed.");
} finally {
  await client.end();
}
