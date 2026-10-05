import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Client } = pg;
const scrypt = promisify(scryptCallback);

const connectionString = process.env.DATABASE_URL;
const email = (process.env.ADMIN_EMAIL ?? "admin@yatra.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "YATRA Super Admin";

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!password) {
  throw new Error(
    "ADMIN_PASSWORD is required. Example: $env:ADMIN_PASSWORD='password123'; npm run db:bootstrap:admin -w @yatra/db",
  );
}
if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters.");

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false },
});

await client.connect();

try {
  await client.query("BEGIN");

  const roleResult = await client.query(
    `SELECT "id" FROM "Role" WHERE "key" = 'SUPER_ADMIN'::"RoleKey" LIMIT 1`,
  );
  if (roleResult.rows.length === 0) {
    throw new Error("SUPER_ADMIN role not found. Run db:seed:roles first.");
  }

  const roleId = roleResult.rows[0].id;
  const id = `admin_${randomBytes(12).toString("hex")}`;

  const userResult = await client.query(
    `
      INSERT INTO "User"
        ("id","email","emailNormalized","passwordHash","name","status","emailVerifiedAt","createdAt","updatedAt")
      VALUES
        ($1,$2,$3,$4,$5,'ACTIVE'::"UserStatus",CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("emailNormalized")
      DO UPDATE SET
        "email" = EXCLUDED."email",
        "passwordHash" = EXCLUDED."passwordHash",
        "name" = EXCLUDED."name",
        "status" = 'ACTIVE'::"UserStatus",
        "emailVerifiedAt" = COALESCE("User"."emailVerifiedAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "id","email"
    `,
    [id, email, email, passwordHash, name],
  );

  const user = userResult.rows[0];

  await client.query(
    `
      INSERT INTO "UserRole" ("userId","roleId","assignedById","assignedAt")
      VALUES ($1,$2,NULL,CURRENT_TIMESTAMP)
      ON CONFLICT ("userId","roleId") DO NOTHING
    `,
    [user.id, roleId],
  );

  await client.query(
    `
      INSERT INTO "AuditLog" ("actorUserId","action","entityType","entityId","metadata","createdAt")
      VALUES ($1,'SUPER_ADMIN_BOOTSTRAPPED','User',$1,$2::jsonb,CURRENT_TIMESTAMP)
    `,
    [user.id, JSON.stringify({ email })],
  );

  await client.query("COMMIT");
  console.log(`Super admin ready: ${user.email}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
