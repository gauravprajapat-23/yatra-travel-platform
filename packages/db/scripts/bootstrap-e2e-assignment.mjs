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

const ids = {
  vehicleClass: "e2e_assignment_class",
  vehicle: "e2e_assignment_vehicle",
  driver: "e2e_assignment_driver",
  booking: "e2e_assignment_booking",
};

const reference = "YAT-E2EASSIGN";

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "BookingStatusHistory" WHERE "bookingId" = $1`,
    [ids.booking],
  );
  await client.query(
    `DELETE FROM "CarBooking" WHERE "id" = $1 OR "reference" = $2`,
    [ids.booking, reference],
  );
  await client.query(
    `DELETE FROM "DriverVehicleClass" WHERE "driverId" = $1 OR "vehicleClassId" = $2`,
    [ids.driver, ids.vehicleClass],
  );
  await client.query(`DELETE FROM "Driver" WHERE "id" = $1`, [ids.driver]);
  await client.query(`DELETE FROM "Vehicle" WHERE "id" = $1`, [ids.vehicle]);
  await client.query(`DELETE FROM "VehicleClass" WHERE "id" = $1`, [ids.vehicleClass]);

  await client.query(
    `
      INSERT INTO "VehicleClass"
        ("id","slug","name","description","defaultSeats","defaultLuggage","isActive","sortOrder","createdAt","updatedAt")
      VALUES
        ($1,'e2e-assignment-class','E2E Assignment SUV','Browser-test vehicle class',6,3,true,999,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [ids.vehicleClass],
  );

  await client.query(
    `
      INSERT INTO "Vehicle"
        ("id","slug","registrationNumber","displayName","vehicleClassId","status","seats","luggage","airConditioned","isFeatured","createdAt","updatedAt")
      VALUES
        ($1,'e2e-assignment-vehicle','MP04E2E9999','E2E Operations Vehicle',$2,'ACTIVE'::"VehicleStatus",6,3,true,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [ids.vehicle, ids.vehicleClass],
  );

  await client.query(
    `
      INSERT INTO "Driver"
        ("id","displayName","status","phoneLast4","licenseExpiry","createdAt","updatedAt")
      VALUES
        ($1,'E2E Operations Driver','ACTIVE'::"DriverStatus",'4242',CURRENT_TIMESTAMP + INTERVAL '365 days',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [ids.driver],
  );

  await client.query(
    `
      INSERT INTO "DriverVehicleClass"
        ("driverId","vehicleClassId","approvedAt")
      VALUES ($1,$2,CURRENT_TIMESTAMP)
    `,
    [ids.driver, ids.vehicleClass],
  );

  await client.query(
    `
      INSERT INTO "CarBooking" (
        "id","reference","idempotencyKey","requestFingerprint","status","tripType",
        "originText","destinationText","startsAt","endsAt","travellers",
        "guestName","guestEmail","vehicleClassId","currency","subtotalMinor",
        "discountMinor","taxMinor","totalMinor","priceSnapshot","policySnapshot",
        "confirmedAt","createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'e2e-assignment-idempotency-0001','e2e-assignment-fingerprint',
        'CONFIRMED'::"BookingStatus",'ONE_WAY'::"TripType",
        'Bhopal','Indore',CURRENT_TIMESTAMP + INTERVAL '7 days',
        CURRENT_TIMESTAMP + INTERVAL '7 days 5 hours',2,
        'E2E Traveller','e2e-traveller@yatra.test',$3,'INR',120000,
        0,0,120000,$4::jsonb,$5::jsonb,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [
      ids.booking,
      reference,
      ids.vehicleClass,
      JSON.stringify({
        source: "e2e",
        subtotalMinor: "120000",
        discountMinor: "0",
        taxMinor: "0",
        totalMinor: "120000",
        currency: "INR",
      }),
      JSON.stringify({
        source: "e2e",
        code: "CAR_BOOKING",
        version: 1,
      }),
    ],
  );

  await client.query(
    `
      INSERT INTO "BookingStatusHistory"
        ("bookingId","fromStatus","toStatus","reason","metadata","createdAt")
      VALUES
        ($1,NULL,'CONFIRMED'::"BookingStatus",'E2E confirmed assignment fixture',$2::jsonb,CURRENT_TIMESTAMP)
    `,
    [ids.booking, JSON.stringify({ fixture: true })],
  );

  await client.query("COMMIT");
  console.log(`E2E assignment fixture ready: ${reference}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
