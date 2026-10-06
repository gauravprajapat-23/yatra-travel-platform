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
  const expectedTables = ["PaymentIntent", "PaymentWebhookEvent", "Refund"];

  const tables = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [expectedTables],
  );

  const found = new Set(tables.rows.map((row) => row.tablename));
  const missing = expectedTables.filter((table) => !found.has(table));

  if (missing.length) {
    throw new Error(`Missing payment tables: ${missing.join(", ")}`);
  }

  const paymentChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"PaymentIntent"'::regclass
        AND contype = 'c'
    `,
  );

  const names = new Set(paymentChecks.rows.map((row) => row.conname));

  for (const expected of [
    "PaymentIntent_subject_check",
    "PaymentIntent_currency_check",
    "PaymentIntent_amount_check",
  ]) {
    if (!names.has(expected)) {
      throw new Error(`Missing PaymentIntent constraint: ${expected}`);
    }
  }

  const dedupeIndex = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'PaymentWebhookEvent'
        AND indexname = 'PaymentWebhookEvent_provider_dedupeKey_key'
    `,
  );

  if (dedupeIndex.rowCount !== 1) {
    throw new Error("Payment webhook dedupe index is missing.");
  }

  const activeIntentIndexes = await client.query(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'PaymentIntent'
        AND indexname = ANY($1::text[])
    `,
    [[
      "PaymentIntent_one_active_car_booking_idx",
      "PaymentIntent_one_active_package_booking_idx",
    ]],
  );

  const activeIntentNames = new Set(
    activeIntentIndexes.rows.map((row) => row.indexname),
  );

  for (const expected of [
    "PaymentIntent_one_active_car_booking_idx",
    "PaymentIntent_one_active_package_booking_idx",
  ]) {
    if (!activeIntentNames.has(expected)) {
      throw new Error(
        `Missing active-payment uniqueness index: ${expected}`,
      );
    }
  }

  for (const row of activeIntentIndexes.rows) {
    const definition = String(row.indexdef ?? "");
    if (
      !definition.includes("UNIQUE INDEX") ||
      !definition.includes("'CREATED'") ||
      !definition.includes("'AUTHORIZED'")
    ) {
      throw new Error(
        `Active-payment uniqueness index is malformed: ${row.indexname}`,
      );
    }
  }

  console.log("Payment foundation verification passed.");
} finally {
  await client.end();
}
