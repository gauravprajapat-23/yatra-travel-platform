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
  const expectedTables = [
    "VehicleMaintenanceRecord",
    "VehicleComplianceDocument",
  ];

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
  for (const table of expectedTables) {
    if (!found.has(table)) {
      throw new Error(`Missing fleet operations table: ${table}`);
    }
  }

  const maintenanceChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"VehicleMaintenanceRecord"'::regclass
        AND contype = 'c'
    `,
  );
  const maintenanceNames = new Set(
    maintenanceChecks.rows.map((row) => row.conname),
  );

  for (const expected of [
    "VehicleMaintenanceRecord_window_check",
    "VehicleMaintenanceRecord_category_check",
    "VehicleMaintenanceRecord_summary_check",
    "VehicleMaintenanceRecord_odometer_check",
    "VehicleMaintenanceRecord_cost_check",
    "VehicleMaintenanceRecord_currency_check",
    "VehicleMaintenanceRecord_completion_check",
  ]) {
    if (!maintenanceNames.has(expected)) {
      throw new Error(`Missing maintenance constraint: ${expected}`);
    }
  }

  const complianceChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"VehicleComplianceDocument"'::regclass
        AND contype = 'c'
    `,
  );
  const complianceNames = new Set(
    complianceChecks.rows.map((row) => row.conname),
  );

  for (const expected of [
    "VehicleComplianceDocument_label_check",
    "VehicleComplianceDocument_reference_last4_check",
    "VehicleComplianceDocument_window_check",
  ]) {
    if (!complianceNames.has(expected)) {
      throw new Error(`Missing compliance constraint: ${expected}`);
    }
  }

  const maintenanceLink = await client.query(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'VehicleMaintenanceRecord'
        AND indexname = 'VehicleMaintenanceRecord_availabilityBlockId_key'
    `,
  );

  if (maintenanceLink.rowCount !== 1) {
    throw new Error(
      "Maintenance-to-availability uniqueness index is missing.",
    );
  }

  console.log("Fleet maintenance/compliance foundation verification passed.");
} finally {
  await client.end();
}
