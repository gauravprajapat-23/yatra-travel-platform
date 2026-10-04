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
  const tableResult = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = 'BookingPolicyVersion'
    `,
  );

  if (tableResult.rowCount !== 1) {
    throw new Error("BookingPolicyVersion table is missing.");
  }

  const constraintResult = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"BookingPolicyVersion"'::regclass
        AND contype = 'c'
    `,
  );

  const constraints = new Set(
    constraintResult.rows.map((row) => row.conname),
  );

  for (const expected of [
    "BookingPolicyVersion_version_check",
    "BookingPolicyVersion_code_check",
    "BookingPolicyVersion_effective_range_check",
  ]) {
    if (!constraints.has(expected)) {
      throw new Error(`Missing booking policy constraint: ${expected}`);
    }
  }

  const indexResult = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'BookingPolicyVersion'
    `,
  );

  const indexes = new Set(indexResult.rows.map((row) => row.indexname));

  for (const expected of [
    "BookingPolicyVersion_code_version_key",
    "BookingPolicyVersion_one_active_per_code_idx",
  ]) {
    if (!indexes.has(expected)) {
      throw new Error(`Missing booking policy index: ${expected}`);
    }
  }

  const bookingColumns = await client.query(
    `
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'CarBooking'
        AND column_name = ANY($1::text[])
    `,
    [["requestFingerprint", "bookingPolicyVersionId"]],
  );

  const columnMap = new Map(
    bookingColumns.rows.map((row) => [row.column_name, row.is_nullable]),
  );

  if (columnMap.get("requestFingerprint") !== "NO") {
    throw new Error("CarBooking.requestFingerprint must be NOT NULL.");
  }

  if (!columnMap.has("bookingPolicyVersionId")) {
    throw new Error("CarBooking.bookingPolicyVersionId is missing.");
  }

  console.log("Booking policy foundation verification passed.");
} finally {
  await client.end();
}
