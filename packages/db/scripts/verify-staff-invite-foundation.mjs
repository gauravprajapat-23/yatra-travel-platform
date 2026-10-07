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
  const table = await client.query(
    `
      SELECT 1
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = 'StaffInvite'
    `,
  );

  if (table.rowCount !== 1) {
    throw new Error("StaffInvite table is missing.");
  }

  const columns = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'StaffInvite'
    `,
  );

  const actualColumns = new Set(
    columns.rows.map((row) => row.column_name),
  );
  const expectedColumns = [
    "id",
    "userId",
    "tokenHash",
    "createdById",
    "expiresAt",
    "acceptedAt",
    "revokedAt",
    "createdAt",
  ];

  const missingColumns = expectedColumns.filter(
    (column) => !actualColumns.has(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `StaffInvite is missing columns: ${missingColumns.join(", ")}`,
    );
  }

  const indexes = await client.query(
    `
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'StaffInvite'
    `,
  );

  const indexMap = new Map(
    indexes.rows.map((row) => [row.indexname, row.indexdef]),
  );

  for (const expected of [
    "StaffInvite_userId_key",
    "StaffInvite_tokenHash_key",
  ]) {
    const definition = indexMap.get(expected);
    if (!definition || !String(definition).includes("UNIQUE INDEX")) {
      throw new Error(
        `Missing unique StaffInvite index: ${expected}`,
      );
    }
  }

  const foreignKeys = await client.query(
    `
      SELECT conname
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid = '"StaffInvite"'::regclass
    `,
  );

  const foreignKeyNames = new Set(
    foreignKeys.rows.map((row) => row.conname),
  );

  for (const expected of [
    "StaffInvite_userId_fkey",
    "StaffInvite_createdById_fkey",
  ]) {
    if (!foreignKeyNames.has(expected)) {
      throw new Error(
        `Missing StaffInvite foreign key: ${expected}`,
      );
    }
  }

  const invalidHashes = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM "StaffInvite"
      WHERE "tokenHash" !~ '^[0-9a-f]{64}$'
    `,
  );

  if (invalidHashes.rows[0].count !== 0) {
    throw new Error(
      "StaffInvite contains a token hash that is not a SHA-256 hex digest.",
    );
  }

  const invalidPending = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM "StaffInvite" invite
      JOIN "User" user_record ON user_record."id" = invite."userId"
      WHERE invite."acceptedAt" IS NULL
        AND invite."revokedAt" IS NULL
        AND invite."expiresAt" > CURRENT_TIMESTAMP
        AND (
          user_record."status" <> 'INVITED'::"UserStatus"
          OR user_record."passwordHash" IS NOT NULL
        )
    `,
  );

  if (invalidPending.rows[0].count !== 0) {
    throw new Error(
      "Active StaffInvite rows must belong to passwordless INVITED users.",
    );
  }

  console.log("Staff invite foundation verification passed.");
} finally {
  await client.end();
}
