import pg from "pg";

const { Client } = pg;

const expectedTables = [
  "MediaAsset",
  "CmsPage",
  "Destination",
  "TempleProfile",
  "BlogCategory",
  "BlogPost",
  "Faq",
  "ContentRevision",
  "SeoRedirect",
];

const expectedEnums = [
  "ContentStatus",
  "DestinationKind",
  "FaqScope",
];

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
      ORDER BY tablename
    `,
    [expectedTables],
  );

  const actualTables = new Set(tablesResult.rows.map((row) => row.tablename));
  const missingTables = expectedTables.filter((table) => !actualTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing CMS/SEO tables: ${missingTables.join(", ")}`);
  }

  const enumResult = await client.query(
    `
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = ANY($1::text[])
      ORDER BY t.typname
    `,
    [expectedEnums],
  );

  const actualEnums = new Set(enumResult.rows.map((row) => row.typname));
  const missingEnums = expectedEnums.filter((name) => !actualEnums.has(name));

  if (missingEnums.length > 0) {
    throw new Error(`Missing CMS/SEO enums: ${missingEnums.join(", ")}`);
  }

  const redirectChecks = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = '"SeoRedirect"'::regclass
        AND contype = 'c'
    `,
  );

  const checkNames = new Set(redirectChecks.rows.map((row) => row.conname));
  for (const expected of [
    "SeoRedirect_statusCode_check",
    "SeoRedirect_no_self_redirect_check",
  ]) {
    if (!checkNames.has(expected)) {
      throw new Error(`Missing redirect safety constraint: ${expected}`);
    }
  }

  console.log("CMS/SEO foundation verification passed.");
  console.log(`Tables: ${expectedTables.join(", ")}`);
  console.log(`Enums: ${expectedEnums.join(", ")}`);
} finally {
  await client.end();
}
