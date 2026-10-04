import pg from "pg";

const { Client } = pg;

const expectedTables = ["User", "Role", "UserRole", "Session", "AuditLog"];
const expectedRoles = [
  "SUPER_ADMIN",
  "OWNER_ADMIN",
  "BOOKING_SALES",
  "OPERATIONS",
  "CONTENT_SEO",
  "FINANCE",
  "AUDITOR",
  "CUSTOMER",
];

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

await client.connect();

try {
  const tablesResult = await client.query(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY tablename
    `,
    [expectedTables],
  );

  const actualTables = new Set(tablesResult.rows.map((row) => row.tablename));
  const missingTables = expectedTables.filter((table) => !actualTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing auth foundation tables: ${missingTables.join(", ")}`);
  }

  const roleResult = await client.query(
    `SELECT "key"::text AS key FROM "Role" ORDER BY "key"`,
  );
  const actualRoles = new Set(roleResult.rows.map((row) => row.key));
  const missingRoles = expectedRoles.filter((role) => !actualRoles.has(role));

  if (missingRoles.length > 0) {
    throw new Error(`Missing canonical roles: ${missingRoles.join(", ")}`);
  }

  const migrationResult = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"
       ORDER BY started_at DESC
       LIMIT 5`,
  );

  console.log("Auth foundation verification passed.");
  console.log(`Tables: ${expectedTables.join(", ")}`);
  console.log(`Roles: ${expectedRoles.join(", ")}`);
  console.log("Recent migrations:", migrationResult.rows);
} finally {
  await client.end();
}
