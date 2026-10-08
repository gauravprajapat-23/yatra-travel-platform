import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Client } = pg;
const scrypt = promisify(scryptCallback);

const connectionString = process.env.DATABASE_URL;
const email = (process.env.E2E_CUSTOMER_EMAIL ?? "phase9-customer@yatra.test")
  .trim()
  .toLowerCase();
const password =
  process.env.E2E_CUSTOMER_PASSWORD ?? "Phase9-Customer-Only-2026!";
const name = process.env.E2E_CUSTOMER_NAME ?? "Phase 9 Customer";

if (!connectionString) throw new Error("DATABASE_URL is required.");

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

const userId = "e2e_customer_user";
const bookingId = "e2e_customer_booking";
const vehicleClassId = "e2e_customer_class";
const reference = "YAT-E2ECUST";

await client.connect();

try {
  await client.query("BEGIN");

  const roleResult = await client.query(
    `SELECT "id" FROM "Role" WHERE "key" = 'CUSTOMER'::"RoleKey" LIMIT 1`,
  );
  if (roleResult.rows.length === 0) {
    throw new Error("CUSTOMER role not found. Run db:seed:roles first.");
  }

  await client.query(
    `DELETE FROM "BookingStatusHistory" WHERE "bookingId" = $1`,
    [bookingId],
  );
  await client.query(
    `DELETE FROM "CarBooking" WHERE "id" = $1 OR "reference" = $2`,
    [bookingId, reference],
  );
  await client.query(
    `DELETE FROM "UserRole" WHERE "userId" = $1`,
    [userId],
  );
  await client.query(
    `DELETE FROM "Session" WHERE "userId" = $1`,
    [userId],
  );
  await client.query(
    `DELETE FROM "User" WHERE "id" = $1 OR "emailNormalized" = $2`,
    [userId, email],
  );
  await client.query(
    `DELETE FROM "VehicleClass" WHERE "id" = $1`,
    [vehicleClassId],
  );

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  const passwordHash =
    `scrypt$${salt.toString("base64")}$${Buffer.from(derived).toString("base64")}`;

  await client.query(
    `
      INSERT INTO "User"
        ("id","email","emailNormalized","passwordHash","name","status",
         "emailVerifiedAt","createdAt","updatedAt")
      VALUES
        ($1,$2,$2,$3,$4,'ACTIVE'::"UserStatus",
         CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [userId, email, passwordHash, name],
  );

  await client.query(
    `
      INSERT INTO "UserRole" ("userId","roleId","assignedById","assignedAt")
      VALUES ($1,$2,NULL,CURRENT_TIMESTAMP)
    `,
    [userId, roleResult.rows[0].id],
  );

  await client.query(
    `
      INSERT INTO "VehicleClass"
        ("id","slug","name","description","defaultSeats","defaultLuggage",
         "isActive","sortOrder","createdAt","updatedAt")
      VALUES
        ($1,'e2e-customer-class','E2E Customer Car',
         'Customer portal browser-test class',4,2,true,996,
         CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [vehicleClassId],
  );

  const priceSnapshot = JSON.stringify({
    source: "e2e-customer",
    totalMinor: "450000",
    currency: "INR",
  });
  const policySnapshot = JSON.stringify({
    source: "e2e-customer",
    code: "CAR_BOOKING",
    version: 1,
  });

  await client.query(
    `
      INSERT INTO "CarBooking" (
        "id","reference","idempotencyKey","requestFingerprint","status","tripType",
        "originText","destinationText","startsAt","endsAt","travellers",
        "customerUserId","guestName","guestEmail","vehicleClassId","currency",
        "subtotalMinor","discountMinor","taxMinor","totalMinor",
        "priceSnapshot","policySnapshot","confirmedAt","createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'e2e-customer-idempotency-0001','e2e-customer-fingerprint',
        'CONFIRMED'::"BookingStatus",'ONE_WAY'::"TripType",
        'Bhopal','Indore',CURRENT_TIMESTAMP + INTERVAL '21 days',
        CURRENT_TIMESTAMP + INTERVAL '21 days 4 hours',2,
        $3,$4,$5,$6,'INR',450000,0,0,450000,
        $7::jsonb,$8::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [
      bookingId,
      reference,
      userId,
      name,
      email,
      vehicleClassId,
      priceSnapshot,
      policySnapshot,
    ],
  );

  await client.query(
    `
      INSERT INTO "BookingStatusHistory"
        ("bookingId","fromStatus","toStatus","reason","metadata","createdAt")
      VALUES
        ($1,NULL,'CONFIRMED'::"BookingStatus",'E2E customer portal fixture',
         $2::jsonb,CURRENT_TIMESTAMP)
    `,
    [bookingId, JSON.stringify({ fixture: true })],
  );

  await client.query("COMMIT");
  console.log(`E2E verified customer ready: ${email} / ${reference}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
