import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const expectedTables = [
  "TourPackage",
  "PackageDestination",
  "PackageItineraryDay",
  "PackagePriceOption",
  "PackageQuote",
  "PackageBooking",
  "PackageBookingStatusHistory",
];

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

await client.connect();

try {
  const tableResult = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [expectedTables],
  );

  const found = new Set(tableResult.rows.map((row) => row.tablename));
  const missing = expectedTables.filter((table) => !found.has(table));

  if (missing.length) {
    throw new Error(`Missing package booking tables: ${missing.join(", ")}`);
  }

  const enumResult = await client.query(
    `
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'PackagePriceMode'
    `,
  );

  if (enumResult.rowCount !== 1) {
    throw new Error("PackagePriceMode enum is missing.");
  }

  const packageChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"PackageBooking"'::regclass
        AND contype = 'c'
    `,
  );

  const checkNames = new Set(packageChecks.rows.map((row) => row.conname));

  for (const expected of [
    "PackageBooking_travellers_check",
    "PackageBooking_vehicle_count_check",
    "PackageBooking_currency_check",
    "PackageBooking_money_check",
    "PackageBooking_customer_identity_check",
  ]) {
    if (!checkNames.has(expected)) {
      throw new Error(`Missing PackageBooking constraint: ${expected}`);
    }
  }

  console.log("Package booking foundation verification passed.");
} finally {
  await client.end();
}
