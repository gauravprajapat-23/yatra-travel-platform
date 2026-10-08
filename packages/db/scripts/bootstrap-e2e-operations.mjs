import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Client } = pg;
const scrypt = promisify(scryptCallback);

const connectionString = process.env.DATABASE_URL;
const email = (process.env.E2E_OPERATIONS_EMAIL ?? "phase8-ops@yatra.test").trim().toLowerCase();
const password = process.env.E2E_OPERATIONS_PASSWORD ?? "Phase8-Ops-Only-2026!";
const name = process.env.E2E_OPERATIONS_NAME ?? "Phase 8 Operations";

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (password.length < 10) throw new Error("E2E operations password must be at least 10 characters.");

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query("BEGIN");

  const roleResult = await client.query(
    `SELECT "id" FROM "Role" WHERE "key" = 'OPERATIONS'::"RoleKey" LIMIT 1`,
  );
  if (roleResult.rows.length === 0) {
    throw new Error("OPERATIONS role not found. Run db:seed:roles first.");
  }

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  const passwordHash =
    `scrypt$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;
  const id = `e2e_ops_${randomBytes(10).toString("hex")}`;

  const userResult = await client.query(
    `
      INSERT INTO "User"
        ("id","email","emailNormalized","passwordHash","name","status","emailVerifiedAt","createdAt","updatedAt")
      VALUES
        ($1,$2,$3,$4,$5,'ACTIVE'::"UserStatus",CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("emailNormalized") DO UPDATE SET
        "passwordHash" = EXCLUDED."passwordHash",
        "name" = EXCLUDED."name",
        "status" = 'ACTIVE'::"UserStatus",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "id"
    `,
    [id, email, email, passwordHash, name],
  );

  const userId = userResult.rows[0].id;
  const roleId = roleResult.rows[0].id;

  await client.query(
    `DELETE FROM "UserRole" WHERE "userId" = $1`,
    [userId],
  );

  await client.query(
    `
      INSERT INTO "UserRole" ("userId","roleId","assignedById","assignedAt")
      VALUES ($1,$2,NULL,CURRENT_TIMESTAMP)
    `,
    [userId, roleId],
  );

  await client.query(
    `
      INSERT INTO "AuditLog"
        ("action","entityType","entityId","metadata","createdAt")
      VALUES
        ('E2E_OPERATIONS_BOOTSTRAPPED','User',$1,$2::jsonb,CURRENT_TIMESTAMP)
    `,
    [userId, JSON.stringify({ role: "OPERATIONS", disposable: true })],
  );

  await client.query("COMMIT");
  console.log(`E2E operations user ready: ${email}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
