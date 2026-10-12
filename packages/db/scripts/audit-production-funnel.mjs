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
  const queries = [
    ["leads_total", 'SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest FROM "Lead"'],
    ["leads_new", 'SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest FROM "Lead" WHERE "status" IN (\'NEW\',\'IN_PROGRESS\')'],
    ["car_bookings_total", 'SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest FROM "CarBooking"'],
    ["package_bookings_total", 'SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest FROM "PackageBooking"'],
    ["car_quotes_total", 'SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest FROM "CarQuote"'],
    ["package_quotes_total", 'SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest FROM "PackageQuote"'],
  ];

  for (const [label, sql] of queries) {
    const result = await client.query(sql);
    const row = result.rows[0] ?? {};
    console.log(
      "FUNNEL " +
        label +
        " count=" +
        String(row.count ?? 0) +
        " latest=" +
        (row.latest ? new Date(row.latest).toISOString() : "none"),
    );
  }
} finally {
  await client.end();
}
