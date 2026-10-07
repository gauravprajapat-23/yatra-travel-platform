import pg from "pg";

const { Client } = pg;
const baseUrl = (process.env.ADMIN_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? baseUrl;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!email || !password || !databaseUrl) {
  throw new Error("ADMIN_EMAIL, ADMIN_PASSWORD and DATABASE_URL are required.");
}

function cookieFrom(response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Authenticated login did not return a session cookie.");
  return raw.split(";")[0];
}

async function login(loginPassword) {
  return fetch(`${baseUrl}/api/admin-auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: appOrigin,
      "user-agent": "yatra-admin-auth-certification/1.0",
    },
    body: JSON.stringify({ email, password: loginPassword }),
  });
}

const failedLogin = await login(`${password}-invalid`);
if (failedLogin.status !== 401) {
  throw new Error(`Invalid credential check expected 401, received ${failedLogin.status}`);
}
process.stdout.write("PASS invalid admin credentials rejected\n");

const loginResponse = await login(password);
if (loginResponse.status !== 200) {
  throw new Error(
    `Admin login expected 200, received ${loginResponse.status}: ${await loginResponse.text()}`,
  );
}

const cookie = cookieFrom(loginResponse);
const loginBody = await loginResponse.json();
if (!loginBody?.ok || !loginBody?.user?.roles?.includes("SUPER_ADMIN")) {
  throw new Error("Authenticated login did not return the expected super-admin identity.");
}
process.stdout.write("PASS admin login and session cookie created\n");

const protectedRoutes = [
  "/admin",
  "/admin/bookings",
  "/admin/bookings/bulk",
  "/admin/dispatch",
  "/admin/dispatch/resources",
  "/admin/dispatch/calendar",
  "/admin/vehicles",
  "/admin/drivers",
  "/admin/reports",
  "/admin/payments",
  "/admin/customers",
  "/admin/leads",
];

for (const path of protectedRoutes) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    headers: { cookie },
  });
  if (response.status !== 200) {
    throw new Error(`${path} expected authenticated 200, received ${response.status}`);
  }
  process.stdout.write(`PASS authenticated ${path}\n`);
}

const exportResponse = await fetch(`${baseUrl}/api/admin/bookings/export`, {
  redirect: "manual",
  headers: { cookie },
});
if (exportResponse.status !== 200) {
  throw new Error(`Authenticated booking export expected 200, received ${exportResponse.status}`);
}
if (!(exportResponse.headers.get("content-type") ?? "").includes("text/csv")) {
  throw new Error("Authenticated booking export did not return CSV.");
}
process.stdout.write("PASS authenticated booking CSV export\n");

const db = new Client({ connectionString: databaseUrl });
await db.connect();

try {
  const user = await db.query(
    `SELECT "id","lastLoginAt" FROM "User" WHERE "emailNormalized" = $1 LIMIT 1`,
    [email.toLowerCase()],
  );
  if (user.rows.length !== 1 || !user.rows[0].lastLoginAt) {
    throw new Error("Admin login did not update lastLoginAt.");
  }

  const userId = user.rows[0].id;
  const succeeded = await db.query(
    `SELECT COUNT(*)::int AS count FROM "AuditLog"
     WHERE "actorUserId" = $1 AND "action" = 'ADMIN_LOGIN_SUCCEEDED'`,
    [userId],
  );
  if (succeeded.rows[0].count < 1) {
    throw new Error("ADMIN_LOGIN_SUCCEEDED audit record was not written.");
  }

  const failed = await db.query(
    `SELECT COUNT(*)::int AS count FROM "AuditLog"
     WHERE "entityId" = $1 AND "action" = 'ADMIN_LOGIN_FAILED'`,
    [userId],
  );
  if (failed.rows[0].count < 1) {
    throw new Error("ADMIN_LOGIN_FAILED audit record was not written.");
  }

  const activeSession = await db.query(
    `SELECT "id" FROM "Session"
     WHERE "userId" = $1 AND "revokedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP
     ORDER BY "createdAt" DESC LIMIT 1`,
    [userId],
  );
  if (activeSession.rows.length !== 1) {
    throw new Error("Expected an active admin session record after login.");
  }
  process.stdout.write("PASS login audit records and active session persisted\n");

  const logoutResponse = await fetch(`${baseUrl}/api/admin-auth/logout`, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie,
      origin: appOrigin,
    },
  });
  if (logoutResponse.status !== 303) {
    throw new Error(`Admin logout expected 303, received ${logoutResponse.status}`);
  }

  const revoked = await db.query(
    `SELECT "revokedAt" FROM "Session" WHERE "id" = $1`,
    [activeSession.rows[0].id],
  );
  if (!revoked.rows[0]?.revokedAt) {
    throw new Error("Logout did not revoke the active admin session.");
  }
  process.stdout.write("PASS admin logout revoked persisted session\n");

  const afterLogout = await fetch(`${baseUrl}/admin`, {
    redirect: "manual",
    headers: { cookie },
  });
  if (![302, 303, 307, 308].includes(afterLogout.status)) {
    throw new Error(
      `Revoked session must no longer access /admin; received ${afterLogout.status}`,
    );
  }
  process.stdout.write("PASS revoked session denied after logout\n");
} finally {
  await db.end();
}

process.stdout.write("Authenticated admin runtime certification passed.\n");
