import "dotenv/config";
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

const bookingId = "e2e_lifecycle_booking";
const reference = "YAT-E2ELIFE";
const vehicleClassId = "e2e_lifecycle_class";

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "BookingStatusHistory" WHERE "bookingId" = $1`,
    [bookingId],
  );
  await client.query(
    `DELETE FROM "CarBooking" WHERE "id" = $1 OR "reference" = $2`,
    [bookingId, reference],
  );
  await client.query(
    `DELETE FROM "VehicleClass" WHERE "id" = $1`,
    [vehicleClassId],
  );

  await client.query(
    `
      INSERT INTO "VehicleClass"
        ("id","slug","name","description","defaultSeats","defaultLuggage","isActive","sortOrder","createdAt","updatedAt")
      VALUES
        ($1,'e2e-lifecycle-class','E2E Lifecycle Car','Browser-test lifecycle class',4,2,true,998,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [vehicleClassId],
  );

  const priceSnapshot = JSON.stringify({
    source: "e2e-lifecycle",
    subtotalMinor: "0",
    discountMinor: "0",
    taxMinor: "0",
    totalMinor: "0",
    currency: "INR",
  });
  const policySnapshot = JSON.stringify({
    source: "e2e-lifecycle",
    code: "CAR_BOOKING",
    version: 1,
  });

  await client.query(
    `
      INSERT INTO "CarBooking" (
        "id","reference","idempotencyKey","requestFingerprint","status","tripType",
        "originText","destinationText","startsAt","endsAt","travellers",
        "guestName","guestEmail","vehicleClassId","currency","subtotalMinor",
        "discountMinor","taxMinor","totalMinor","priceSnapshot","policySnapshot",
        "createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'e2e-lifecycle-idempotency-0001','e2e-lifecycle-fingerprint',
        'PENDING_REVIEW'::"BookingStatus",'ONE_WAY'::"TripType",
        'Bhopal','Sanchi',CURRENT_TIMESTAMP + INTERVAL '10 days',
        CURRENT_TIMESTAMP + INTERVAL '10 days 3 hours',2,
        'E2E Lifecycle Traveller','e2e-lifecycle@yatra.test',$3,'INR',0,
        0,0,0,$4::jsonb,$5::jsonb,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [bookingId, reference, vehicleClassId, priceSnapshot, policySnapshot],
  );

  await client.query(
    `
      INSERT INTO "BookingStatusHistory"
        ("bookingId","fromStatus","toStatus","reason","metadata","createdAt")
      VALUES
        ($1,NULL,'PENDING_REVIEW'::"BookingStatus",'E2E lifecycle fixture',$2::jsonb,CURRENT_TIMESTAMP)
    `,
    [bookingId, JSON.stringify({ fixture: true })],
  );

  await client.query("COMMIT");
  console.log(`E2E lifecycle fixture ready: ${reference}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
