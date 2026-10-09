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
  availableVehicle: "e2e_assignment_vehicle",
  busyVehicle: "e2e_assignment_busy_vehicle",
  complianceVehicle: "e2e_assignment_compliance_vehicle",
  availableDriver: "e2e_assignment_driver",
  busyDriver: "e2e_assignment_busy_driver",
  targetBooking: "e2e_assignment_booking",
  blockerBooking: "e2e_assignment_blocker",
};

const targetReference = "YAT-E2EASSIGN";
const blockerReference = "YAT-E2EBLOCK";

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "BookingStatusHistory" WHERE "bookingId" IN ($1,$2)`,
    [ids.targetBooking, ids.blockerBooking],
  );
  await client.query(
    `DELETE FROM "CarBooking"
     WHERE "id" IN ($1,$2) OR "reference" IN ($3,$4)`,
    [
      ids.targetBooking,
      ids.blockerBooking,
      targetReference,
      blockerReference,
    ],
  );
  await client.query(
    `DELETE FROM "DriverVehicleClass"
     WHERE "driverId" IN ($1,$2) OR "vehicleClassId" = $3`,
    [ids.availableDriver, ids.busyDriver, ids.vehicleClass],
  );
  await client.query(
    `DELETE FROM "Driver" WHERE "id" IN ($1,$2)`,
    [ids.availableDriver, ids.busyDriver],
  );
  await client.query(
    `DELETE FROM "Vehicle" WHERE "id" IN ($1,$2,$3)`,
    [ids.availableVehicle, ids.busyVehicle, ids.complianceVehicle],
  );
  await client.query(
    `DELETE FROM "VehicleClass" WHERE "id" = $1`,
    [ids.vehicleClass],
  );

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
        ($1,'e2e-assignment-vehicle','MP04E2E9999','E2E Operations Vehicle',$4,'ACTIVE'::"VehicleStatus",6,3,true,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ($2,'e2e-assignment-busy-vehicle','MP04E2E8888','E2E Busy Vehicle',$4,'ACTIVE'::"VehicleStatus",6,3,true,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ($3,'e2e-assignment-compliance-vehicle','MP04E2E7777','E2E Compliance Vehicle',$4,'ACTIVE'::"VehicleStatus",6,3,true,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [ids.availableVehicle, ids.busyVehicle, ids.complianceVehicle, ids.vehicleClass],
  );

  await client.query(
    `
      INSERT INTO "VehicleComplianceDocument" (
        "id","vehicleId","type","label","referenceLast4","issuedAt","expiresAt",
        "blocksDispatch","createdAt","updatedAt"
      )
      VALUES (
        'e2e_assignment_expired_insurance',$1,
        'INSURANCE'::"VehicleDocumentType",'E2E Required Insurance','7777',
        CURRENT_TIMESTAMP - INTERVAL '300 days',
        CURRENT_TIMESTAMP + INTERVAL '3 days',
        true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.complianceVehicle],
  );

  await client.query(
    `
      INSERT INTO "Driver"
        ("id","displayName","status","phoneLast4","licenseExpiry","createdAt","updatedAt")
      VALUES
        ($1,'E2E Operations Driver','ACTIVE'::"DriverStatus",'4242',CURRENT_TIMESTAMP + INTERVAL '365 days',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ($2,'E2E Busy Driver','ACTIVE'::"DriverStatus",'4343',CURRENT_TIMESTAMP + INTERVAL '365 days',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [ids.availableDriver, ids.busyDriver],
  );

  await client.query(
    `
      INSERT INTO "DriverVehicleClass"
        ("driverId","vehicleClassId","approvedAt")
      VALUES
        ($1,$3,CURRENT_TIMESTAMP),
        ($2,$3,CURRENT_TIMESTAMP)
    `,
    [ids.availableDriver, ids.busyDriver, ids.vehicleClass],
  );

  const priceSnapshot = JSON.stringify({
    source: "e2e",
    subtotalMinor: "120000",
    discountMinor: "0",
    taxMinor: "0",
    totalMinor: "120000",
    currency: "INR",
  });
  const policySnapshot = JSON.stringify({
    source: "e2e",
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
      ids.targetBooking,
      targetReference,
      ids.vehicleClass,
      priceSnapshot,
      policySnapshot,
    ],
  );

  await client.query(
    `
      INSERT INTO "CarBooking" (
        "id","reference","idempotencyKey","requestFingerprint","status","tripType",
        "originText","destinationText","startsAt","endsAt","travellers",
        "guestName","guestEmail","vehicleClassId","selectedVehicleId",
        "assignedDriverId","currency","subtotalMinor","discountMinor","taxMinor",
        "totalMinor","priceSnapshot","policySnapshot","confirmedAt","createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'e2e-blocker-idempotency-0001','e2e-blocker-fingerprint',
        'DRIVER_ASSIGNED'::"BookingStatus",'ONE_WAY'::"TripType",
        'Bhopal','Ujjain',CURRENT_TIMESTAMP + INTERVAL '7 days 1 hour',
        CURRENT_TIMESTAMP + INTERVAL '7 days 4 hours',2,
        'E2E Blocker Traveller','e2e-blocker@yatra.test',$3,$4,$5,
        'INR',110000,0,0,110000,$6::jsonb,$7::jsonb,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [
      ids.blockerBooking,
      blockerReference,
      ids.vehicleClass,
      ids.busyVehicle,
      ids.busyDriver,
      JSON.stringify({
        ...JSON.parse(priceSnapshot),
        subtotalMinor: "110000",
        totalMinor: "110000",
      }),
      policySnapshot,
    ],
  );

  await client.query(
    `
      INSERT INTO "BookingStatusHistory"
        ("bookingId","fromStatus","toStatus","reason","metadata","createdAt")
      VALUES
        ($1,NULL,'CONFIRMED'::"BookingStatus",'E2E confirmed assignment fixture',$3::jsonb,CURRENT_TIMESTAMP),
        ($2,'CONFIRMED'::"BookingStatus",'DRIVER_ASSIGNED'::"BookingStatus",'E2E overlapping blocker fixture',$3::jsonb,CURRENT_TIMESTAMP)
    `,
    [ids.targetBooking, ids.blockerBooking, JSON.stringify({ fixture: true })],
  );

  await client.query("COMMIT");
  console.log(
    `E2E assignment fixture ready: ${targetReference} with blocker ${blockerReference}`,
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
