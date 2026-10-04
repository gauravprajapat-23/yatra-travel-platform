import { randomUUID } from "node:crypto";
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

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const vehicleClassId = `test_vehicle_class_${suffix}`;
const quoteId = `test_quote_${suffix}`;
const policyId = `test_policy_${suffix}`;
const bookingId = `test_booking_${suffix}`;
const bookingId2 = `test_booking_2_${suffix}`;
const idempotencyKey = `test-idempotency-${suffix}`;

try {
  await client.query("BEGIN");

  await client.query(
    `
      INSERT INTO "VehicleClass"
        ("id", "slug", "name", "defaultSeats", "isActive", "sortOrder", "createdAt", "updatedAt")
      VALUES ($1, $2, 'Invariant Test Class', 4, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [vehicleClassId, `invariant-test-${suffix}`],
  );

  await client.query(
    `
      INSERT INTO "BookingPolicyVersion"
        ("id", "code", "version", "status", "document", "activatedAt", "createdAt", "updatedAt")
      VALUES ($1, $2, 1, 'ACTIVE', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [policyId, `CI_TEST_${suffix.toUpperCase()}`],
  );

  await client.query(
    `
      INSERT INTO "CarQuote"
        ("id", "tripType", "originText", "destinationText", "startsAt",
         "travellers", "vehicleClassId", "currency", "subtotalMinor",
         "discountMinor", "taxMinor", "totalMinor", "priceBreakdown",
         "expiresAt", "createdAt")
      VALUES
        ($1, 'ONE_WAY', 'Origin', 'Destination', CURRENT_TIMESTAMP + INTERVAL '2 days',
         2, $2, 'INR', 0, 0, 0, 0, '{}'::jsonb,
         CURRENT_TIMESTAMP + INTERVAL '30 minutes', CURRENT_TIMESTAMP)
    `,
    [quoteId, vehicleClassId],
  );

  const bookingInsert = `
    INSERT INTO "CarBooking"
      ("id", "reference", "quoteId", "idempotencyKey", "requestFingerprint",
       "status", "tripType", "originText", "destinationText", "startsAt",
       "travellers", "guestName", "guestEmail", "vehicleClassId",
       "currency", "subtotalMinor", "discountMinor", "taxMinor", "totalMinor",
       "priceSnapshot", "policySnapshot", "bookingPolicyVersionId",
       "createdAt", "updatedAt")
    VALUES
      ($1, $2, $3, $4, 'fingerprint', 'PENDING_REVIEW', 'ONE_WAY',
       'Origin', 'Destination', CURRENT_TIMESTAMP + INTERVAL '2 days',
       2, 'Test Guest', 'test@example.com', $5, 'INR', 0, 0, 0, 0,
       '{}'::jsonb, '{}'::jsonb, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  await client.query(bookingInsert, [
    bookingId,
    `YAT-TEST-${suffix}`,
    quoteId,
    idempotencyKey,
    vehicleClassId,
    policyId,
  ]);

  let duplicateIdempotencyRejected = false;

  await client.query("SAVEPOINT duplicate_idempotency");

  try {
    await client.query(
      `
        INSERT INTO "CarBooking"
          ("id", "reference", "idempotencyKey", "requestFingerprint",
           "status", "tripType", "originText", "destinationText", "startsAt",
           "travellers", "guestName", "guestEmail", "vehicleClassId",
           "currency", "subtotalMinor", "discountMinor", "taxMinor", "totalMinor",
           "priceSnapshot", "policySnapshot", "bookingPolicyVersionId",
           "createdAt", "updatedAt")
        VALUES
          ($1, $2, $3, 'different', 'PENDING_REVIEW', 'ONE_WAY',
           'Origin', 'Destination', CURRENT_TIMESTAMP + INTERVAL '3 days',
           2, 'Test Guest', 'test@example.com', $4, 'INR', 0, 0, 0, 0,
           '{}'::jsonb, '{}'::jsonb, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        bookingId2,
        `YAT-TEST-2-${suffix}`,
        idempotencyKey,
        vehicleClassId,
        policyId,
      ],
    );
  } catch (error) {
    if (error?.code === "23505") {
      duplicateIdempotencyRejected = true;
      await client.query("ROLLBACK TO SAVEPOINT duplicate_idempotency");
    } else {
      throw error;
    }
  }

  if (!duplicateIdempotencyRejected) {
    throw new Error("Duplicate idempotency key was not rejected.");
  }

  console.log("Booking invariant verification passed.");
} finally {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Transaction may already be aborted; connection close still cleans it up.
  }
  await client.end();
}
