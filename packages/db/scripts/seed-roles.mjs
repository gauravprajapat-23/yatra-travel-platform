import pg from "pg";

const { Client } = pg;

const roles = [
  ["role_super_admin", "SUPER_ADMIN", "Super Admin"],
  ["role_owner_admin", "OWNER_ADMIN", "Owner / Admin"],
  ["role_booking_sales", "BOOKING_SALES", "Booking / Sales"],
  ["role_operations", "OPERATIONS", "Operations"],
  ["role_content_seo", "CONTENT_SEO", "Content / SEO"],
  ["role_finance", "FINANCE", "Finance"],
  ["role_auditor", "AUDITOR", "Read-only Auditor"],
  ["role_customer", "CUSTOMER", "Customer"],
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
  await client.query("BEGIN");

  for (const [id, key, label] of roles) {
    await client.query(
      `
        INSERT INTO "Role" ("id", "key", "label", "createdAt", "updatedAt")
        VALUES ($1, $2::"RoleKey", $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("key")
        DO UPDATE SET
          "label" = EXCLUDED."label",
          "updatedAt" = CURRENT_TIMESTAMP
      `,
      [id, key, label],
    );
  }

  await client.query("COMMIT");
  console.log(`Seeded ${roles.length} canonical roles.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
