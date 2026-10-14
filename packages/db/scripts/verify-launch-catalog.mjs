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
  const checks = [
    ["published destinations", "SELECT COUNT(*)::int AS count FROM \"Destination\" WHERE \"status\"='PUBLISHED' AND \"slug\" IN ('ujjain','omkareshwar','indore','maheshwar','mandu','bhopal','sanchi','varanasi')", 8],
    ["active launch vehicles", "SELECT COUNT(*)::int AS count FROM \"Vehicle\" WHERE \"status\"='ACTIVE' AND \"slug\" IN ('toyota-innova-crysta','maruti-suzuki-ertiga','toyota-fortuner')", 3],
    ["published launch packages", "SELECT COUNT(*)::int AS count FROM \"TourPackage\" WHERE \"status\"='PUBLISHED' AND \"slug\" IN ('ujjain-omkareshwar-jyotirlinga','indore-maheshwar-mandu','bhopal-sanchi-heritage','varanasi-spiritual-journey','madhya-pradesh-spiritual-circuit')", 5],
    ["active launch pricing rules", "SELECT COUNT(*)::int AS count FROM \"PricingRule\" WHERE \"status\"='ACTIVE' AND \"id\" LIKE 'catalog-rate-%'", 9],
    ["open launch departures", "SELECT COUNT(*)::int AS count FROM \"PackageDeparture\" WHERE \"status\"='OPEN' AND \"id\" LIKE 'catalog-package-%-departure-%'", 15],
    ["published launch FAQs", "SELECT COUNT(*)::int AS count FROM \"Faq\" WHERE \"status\"='PUBLISHED' AND \"id\" LIKE 'catalog-faq-%'", 5],
    ["published SEO travel guides", "SELECT COUNT(*)::int AS count FROM \"BlogPost\" WHERE \"status\"='PUBLISHED' AND \"id\" LIKE 'catalog-guide-%'", 5],
    ["launch promotion", "SELECT COUNT(*)::int AS count FROM \"Promotion\" WHERE \"status\"='ACTIVE' AND \"code\"='YATRA5'", 1],
  ];

  for (const [label, sql, minimum] of checks) {
    const result = await client.query(sql);
    const count = result.rows[0]?.count ?? 0;
    if (count < minimum) {
      throw new Error(label + " incomplete: expected at least " + minimum + ", found " + count);
    }
    console.log("PASS " + label + ": " + count);
  }

  const missingImages = await client.query(
    "SELECT v.\"slug\" FROM \"Vehicle\" v LEFT JOIN \"VehicleMedia\" vm ON vm.\"vehicleId\"=v.\"id\" AND vm.\"isPrimary\"=true WHERE v.\"slug\" IN ('toyota-innova-crysta','maruti-suzuki-ertiga','toyota-fortuner') AND vm.\"mediaId\" IS NULL",
  );
  if (missingImages.rowCount) {
    throw new Error("Launch vehicles missing primary media: " + missingImages.rows.map((row) => row.slug).join(", "));
  }

  console.log("Launch catalog verification passed.");
} finally {
  await client.end();
}
