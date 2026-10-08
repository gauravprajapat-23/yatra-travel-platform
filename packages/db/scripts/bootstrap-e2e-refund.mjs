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
  vehicleClass: "e2e_refund_class",
  booking: "e2e_refund_booking",
  payment: "e2e_refund_payment",
};
const reference = "YAT-E2EREFUND";

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "Refund" WHERE "paymentIntentId" = $1`,
    [ids.payment],
  );
  await client.query(
    `DELETE FROM "PaymentWebhookEvent" WHERE "paymentIntentId" = $1`,
    [ids.payment],
  );
  await client.query(
    `DELETE FROM "PaymentIntent" WHERE "id" = $1`,
    [ids.payment],
  );
  await client.query(
    `DELETE FROM "BookingStatusHistory" WHERE "bookingId" = $1`,
    [ids.booking],
  );
  await client.query(
    `DELETE FROM "CarBooking" WHERE "id" = $1 OR "reference" = $2`,
    [ids.booking, reference],
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
        ($1,'e2e-refund-class','E2E Refund Car','Browser-test refund class',4,2,true,997,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `,
    [ids.vehicleClass],
  );

  const priceSnapshot = JSON.stringify({
    source: "e2e-refund",
    subtotalMinor: "120000",
    discountMinor: "0",
    taxMinor: "0",
    totalMinor: "120000",
    currency: "INR",
  });
  const policySnapshot = JSON.stringify({
    source: "e2e-refund",
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
        "confirmedAt","cancelledAt","createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'e2e-refund-idempotency-0001','e2e-refund-fingerprint',
        'CANCELLED'::"BookingStatus",'ONE_WAY'::"TripType",
        'Bhopal','Ujjain',CURRENT_TIMESTAMP + INTERVAL '14 days',
        CURRENT_TIMESTAMP + INTERVAL '14 days 4 hours',2,
        'E2E Refund Traveller','e2e-refund@yatra.test',$3,'INR',120000,
        0,0,120000,$4::jsonb,$5::jsonb,
        CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.booking, reference, ids.vehicleClass, priceSnapshot, policySnapshot],
  );

  await client.query(
    `
      INSERT INTO "PaymentIntent" (
        "id","provider","status","idempotencyKey","carBookingId",
        "providerOrderId","providerPaymentId","currency","amountMinor",
        "amountPaidMinor","receipt","capturedAt","createdAt","updatedAt"
      )
      VALUES (
        $1,'RAZORPAY'::"PaymentProvider",'CAPTURED'::"PaymentStatus",
        'e2e-refund-payment-idempotency-0001',$2,
        'order_e2e_refund','pay_e2e_refund','INR',120000,
        120000,'e2e-refund-receipt',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.payment, ids.booking],
  );

  await client.query(
    `
      INSERT INTO "BookingStatusHistory"
        ("bookingId","fromStatus","toStatus","reason","metadata","createdAt")
      VALUES
        ($1,NULL,'CONFIRMED'::"BookingStatus",'E2E refund fixture confirmed',$2::jsonb,CURRENT_TIMESTAMP - INTERVAL '1 minute'),
        ($1,'CONFIRMED'::"BookingStatus",'CANCELLED'::"BookingStatus",'E2E refund fixture cancelled',$2::jsonb,CURRENT_TIMESTAMP)
    `,
    [ids.booking, JSON.stringify({ fixture: true })],
  );

  await client.query("COMMIT");
  console.log(`E2E refund fixture ready: ${reference}`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
