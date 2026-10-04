import pg from "pg";

const { Client } = pg;

const expectedTables = [
  "CarQuote",
  "CarBooking",
  "BookingStatusHistory",
];

const expectedEnums = ["BookingStatus"];

const expectedChecks = {
  CarQuote: [
    "CarQuote_travellers_check",
    "CarQuote_trip_range_check",
    "CarQuote_currency_check",
    "CarQuote_money_check",
    "CarQuote_expiry_check",
  ],
  CarBooking: [
    "CarBooking_travellers_check",
    "CarBooking_trip_range_check",
    "CarBooking_currency_check",
    "CarBooking_money_check",
    "CarBooking_customer_identity_check",
  ],
};

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
  const tablesResult = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `,
    [expectedTables],
  );

  const tableSet = new Set(tablesResult.rows.map((row) => row.tablename));
  const missingTables = expectedTables.filter((table) => !tableSet.has(table));

  if (missingTables.length) {
    throw new Error(`Missing car-booking tables: ${missingTables.join(", ")}`);
  }

  const enumResult = await client.query(
    `
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = ANY($1::text[])
    `,
    [expectedEnums],
  );

  const enumSet = new Set(enumResult.rows.map((row) => row.typname));
  const missingEnums = expectedEnums.filter((name) => !enumSet.has(name));

  if (missingEnums.length) {
    throw new Error(`Missing booking enums: ${missingEnums.join(", ")}`);
  }

  for (const [table, checks] of Object.entries(expectedChecks)) {
    const result = await client.query(
      `
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = $1::regclass
          AND contype = 'c'
      `,
      [`"${table}"`],
    );

    const names = new Set(result.rows.map((row) => row.conname));
    const missing = checks.filter((check) => !names.has(check));

    if (missing.length) {
      throw new Error(
        `Missing constraints on ${table}: ${missing.join(", ")}`,
      );
    }
  }

  console.log("Car booking foundation verification passed.");
} finally {
  await client.end();
}
