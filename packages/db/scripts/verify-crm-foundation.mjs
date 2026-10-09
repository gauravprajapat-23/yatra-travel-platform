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
  const expectedTables = ["CrmInteraction", "CrmFollowUpTask"];
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
      throw new Error(`Missing CRM table: ${table}`);
    }
  }

  for (const [table, expected] of [
    [
      "CrmInteraction",
      [
        "CrmInteraction_subject_identity_check",
        "CrmInteraction_guest_email_normalized_check",
        "CrmInteraction_body_check",
        "CrmInteraction_subject_check",
      ],
    ],
    [
      "CrmFollowUpTask",
      [
        "CrmFollowUpTask_subject_identity_check",
        "CrmFollowUpTask_guest_email_normalized_check",
        "CrmFollowUpTask_title_check",
        "CrmFollowUpTask_notes_check",
        "CrmFollowUpTask_completion_check",
      ],
    ],
  ]) {
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
    for (const name of expected) {
      if (!names.has(name)) {
        throw new Error(`Missing CRM constraint: ${name}`);
      }
    }
  }

  console.log("CRM foundation verification passed.");
} finally {
  await client.end();
}
