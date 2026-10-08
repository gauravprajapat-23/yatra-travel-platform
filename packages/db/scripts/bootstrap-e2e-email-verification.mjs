import "dotenv/config";
import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Client } = pg;
const scrypt = promisify(scryptCallback);

const connectionString = process.env.DATABASE_URL;
const email = (process.env.E2E_VERIFY_EMAIL ?? "phase10-verify@yatra.test").trim().toLowerCase();
const password = process.env.E2E_CUSTOMER_PASSWORD;
const name = process.env.E2E_VERIFY_NAME ?? "Phase 10 Verify Customer";
const rawToken = createHash("sha256")
  .update("phase10-email-verification-e2e")
  .digest("base64url");

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!password) throw new Error("E2E_CUSTOMER_PASSWORD is required.");

function hashToken(token) {
  return createHash("sha256")
    .update(`auth-action:${token}`)
    .digest("hex");
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query("BEGIN");

  const role = await client.query(
    `SELECT "id" FROM "Role" WHERE "key" = 'CUSTOMER'::"RoleKey" LIMIT 1`,
  );
  if (role.rows.length !== 1) {
    throw new Error("CUSTOMER role not found. Run db:seed:roles first.");
  }

  const existing = await client.query(
    `SELECT "id" FROM "User" WHERE "emailNormalized" = $1 LIMIT 1`,
    [email],
  );
  const userId =
    existing.rows[0]?.id ??
    `e2e_verify_${randomBytes(10).toString("hex")}`;

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  const passwordHash =
    `scrypt$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;

  await client.query(
    `
      INSERT INTO "User"
        ("id","email","emailNormalized","passwordHash","name","status","emailVerifiedAt","createdAt","updatedAt")
      VALUES
        ($1,$2,$3,$4,$5,'ACTIVE'::"UserStatus",NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("emailNormalized") DO UPDATE SET
        "passwordHash" = EXCLUDED."passwordHash",
        "name" = EXCLUDED."name",
        "status" = 'ACTIVE'::"UserStatus",
        "emailVerifiedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    `,
    [userId, email, email, passwordHash, name],
  );

  await client.query(
    `DELETE FROM "UserRole" WHERE "userId" = $1`,
    [userId],
  );
  await client.query(
    `
      INSERT INTO "UserRole" ("userId","roleId","assignedById","assignedAt")
      VALUES ($1,$2,NULL,CURRENT_TIMESTAMP)
    `,
    [userId, role.rows[0].id],
  );

  await client.query(
    `DELETE FROM "AuthActionToken" WHERE "userId" = $1`,
    [userId],
  );

  await client.query(
    `
      INSERT INTO "AuthActionToken"
        ("id","userId","purpose","tokenHash","expiresAt","createdAt")
      VALUES
        ('e2e_email_verify_token',$1,'EMAIL_VERIFICATION'::"AuthActionPurpose",$2,CURRENT_TIMESTAMP + INTERVAL '1 hour',CURRENT_TIMESTAMP)
    `,
    [userId, hashToken(rawToken)],
  );

  await client.query("COMMIT");
  console.log(`E2E email verification fixture ready: ${email}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
