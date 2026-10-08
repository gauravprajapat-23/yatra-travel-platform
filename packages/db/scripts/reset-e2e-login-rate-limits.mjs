import "dotenv/config";
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
  const result = await client.query(
    `
      DELETE FROM "AuditLog"
      WHERE "entityType" = 'AuthRateLimit'
        AND "action" IN ('ADMIN_LOGIN_RATE_IDENTITY','ADMIN_LOGIN_RATE_IP')
    `,
  );

  console.log(`Cleared ${result.rowCount ?? 0} CI auth rate-limit audit rows.`);
} finally {
  await client.end();
}
