import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const { Client } = pg;

const baseUrl = (
  process.env.ADMIN_SMOKE_BASE_URL ?? "http://127.0.0.1:3000"
).replace(/\/$/, "");
const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? baseUrl;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const suffix = randomBytes(8).toString("hex");
const userId = `invite_cert_${suffix}`;
const inviteId = `invite_cert_token_${suffix}`;
const email = `invite-cert-${suffix}@yatra.test`;
const rawToken = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

const db = new Client({ connectionString: databaseUrl });
await db.connect();

try {
  const role = await db.query(
    `SELECT "id" FROM "Role" WHERE "key" = 'BOOKING_SALES'::"RoleKey" LIMIT 1`,
  );

  if (role.rows.length !== 1) {
    throw new Error("BOOKING_SALES role is missing.");
  }

  await db.query("BEGIN");

  await db.query(
    `
      INSERT INTO "User"
        ("id","email","emailNormalized","name","status","createdAt","updatedAt")
      VALUES
        ($1,$2,$2,'Invite Certification User','INVITED'::"UserStatus",CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [userId, email],
  );

  await db.query(
    `
      INSERT INTO "UserRole" ("userId","roleId","assignedById","assignedAt")
      VALUES ($1,$2,NULL,CURRENT_TIMESTAMP)
    `,
    [userId, role.rows[0].id],
  );

  await db.query(
    `
      INSERT INTO "StaffInvite"
        ("id","userId","tokenHash","createdById","expiresAt","createdAt")
      VALUES ($1,$2,$3,NULL,$4,CURRENT_TIMESTAMP)
    `,
    [inviteId, userId, tokenHash, expiresAt],
  );

  await db.query("COMMIT");

  const inviteResponse = await fetch(
    `${baseUrl}/admin/invite/${encodeURIComponent(rawToken)}`,
    {
      redirect: "manual",
      headers: {
        "user-agent": "yatra-staff-invite-certification/1.0",
      },
    },
  );

  if (inviteResponse.status !== 200) {
    throw new Error(
      `Valid staff invite expected 200, received ${inviteResponse.status}`,
    );
  }

  const inviteHtml = await inviteResponse.text();

  if (
    !inviteHtml.includes(email) ||
    !inviteHtml.includes("Set up your admin access")
  ) {
    throw new Error(
      "Valid staff invite page did not render the expected invited identity.",
    );
  }

  process.stdout.write("PASS valid staff invite page renders invited identity\n");

  const loginResponse = await fetch(`${baseUrl}/api/admin-auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: appOrigin,
      "user-agent": "yatra-staff-invite-certification/1.0",
    },
    body: JSON.stringify({
      email,
      password: "NotActivated12345",
    }),
  });

  if (loginResponse.status !== 401) {
    throw new Error(
      `INVITED account must not authenticate before acceptance; received ${loginResponse.status}`,
    );
  }

  process.stdout.write("PASS invited passwordless account cannot authenticate\n");

  const invalidResponse = await fetch(
    `${baseUrl}/admin/invite/${encodeURIComponent(rawToken + "-invalid")}`,
    {
      redirect: "manual",
      headers: {
        "user-agent": "yatra-staff-invite-certification/1.0",
      },
    },
  );

  if (invalidResponse.status !== 200) {
    throw new Error(
      `Invalid invite page expected safe 200 response, received ${invalidResponse.status}`,
    );
  }

  const invalidHtml = await invalidResponse.text();
  if (!invalidHtml.includes("Invite unavailable")) {
    throw new Error("Invalid invite did not render the safe unavailable state.");
  }

  process.stdout.write("PASS invalid staff invite renders safe unavailable state\n");
} finally {
  await db.query(`DELETE FROM "User" WHERE "id" = $1`, [userId]).catch(() => undefined);
  await db.end();
}

process.stdout.write("Staff invite runtime certification passed.\n");
