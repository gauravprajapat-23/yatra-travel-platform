import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

await client.connect();

try {
  const table = await client.query(
    `SELECT to_regclass('"PackageDeparture"') AS name`,
  );
  if (!table.rows[0]?.name) {
    throw new Error("PackageDeparture table is missing.");
  }

  const columns = await client.query(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'PackageQuote' AND column_name IN ('departureId','departureSnapshot'))
          OR
          (table_name = 'PackageBooking' AND column_name IN ('departureId','departureSnapshot','inventoryReleasedAt'))
        )
    `,
  );

  const found = new Set(
    columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  for (const expected of [
    "PackageQuote.departureId",
    "PackageQuote.departureSnapshot",
    "PackageBooking.departureId",
    "PackageBooking.departureSnapshot",
    "PackageBooking.inventoryReleasedAt",
  ]) {
    if (!found.has(expected)) {
      throw new Error(`Missing departure inventory column: ${expected}`);
    }
  }

  const checks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"PackageDeparture"'::regclass
        AND contype = 'c'
    `,
  );
  const names = new Set(checks.rows.map((row) => row.conname));
  for (const expected of [
    "PackageDeparture_window_check",
    "PackageDeparture_capacity_check",
    "PackageDeparture_unlimited_reserved_check",
    "PackageDeparture_sales_window_check",
    "PackageDeparture_sales_before_departure_check",
  ]) {
    if (!names.has(expected)) {
      throw new Error(`Missing package departure constraint: ${expected}`);
    }
  }

  const indexes = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'PackageDeparture_packageId_startsAt_key',
          'PackageDeparture_packageId_status_startsAt_idx',
          'PackageBooking_departureId_status_idx'
        )
    `,
  );
  if (indexes.rowCount !== 3) {
    throw new Error("Package departure inventory indexes are incomplete.");
  }

  console.log("Package departure inventory foundation verification passed.");
} finally {
  await client.end();
}
