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

const promotionId = "e2e_promotion_preview";
const quoteId = "e2e_promotion_quote";
const bookingQuoteId = "e2e_promotion_booking_quote";
const limitBookingId = "e2e_promotion_limit_booking";
const fixturePromotionIds = [
  promotionId,
  "e2e_promotion_expired",
  "e2e_promotion_package_only",
  "e2e_promotion_minimum",
  "e2e_promotion_limit",
];

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "PromotionRedemption" WHERE "promotionId" = ANY($1::text[])`,
    [fixturePromotionIds],
  );
  await client.query(
    `DELETE FROM "CarBooking" WHERE "id" = $1 OR "reference" = 'YAT-E2EPROMOLIMIT'`,
    [limitBookingId],
  );
  await client.query(
    `DELETE FROM "CarQuote" WHERE "id" IN ($1,$2)`,
    [quoteId, bookingQuoteId],
  );
  await client.query(
    `DELETE FROM "Promotion"
     WHERE "id" = ANY($1::text[])
        OR "code" IN ('E2E10','E2EEXPIRED','E2EPACK','E2EMIN','E2ELIMIT')`,
    [fixturePromotionIds],
  );

  await client.query(
    `
      INSERT INTO "Promotion" (
        "id","code","name","description","status","scope","discountKind",
        "percentageBps","currency","minSubtotalMinor","maxDiscountMinor",
        "maxRedemptions","redeemedCount","perCustomerLimit","activeFrom",
        "activeTo","createdAt","updatedAt"
      )
      VALUES (
        $1,'E2E10','E2E Ten Percent','Disposable browser promotion',
        'ACTIVE'::"PromotionStatus",'CAR'::"PromotionScope",
        'PERCENTAGE'::"PromotionDiscountKind",1000,NULL,50000,20000,
        10,0,1,CURRENT_TIMESTAMP - INTERVAL '1 minute',
        CURRENT_TIMESTAMP + INTERVAL '1 day',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [promotionId],
  );

  await client.query(
    `
      INSERT INTO "Promotion" (
        "id","code","name","status","scope","discountKind","percentageBps",
        "minSubtotalMinor","maxRedemptions","redeemedCount","perCustomerLimit",
        "activeFrom","activeTo","createdAt","updatedAt"
      )
      VALUES
        ('e2e_promotion_expired','E2EEXPIRED','Expired E2E Promotion',
         'ACTIVE'::"PromotionStatus",'CAR'::"PromotionScope",
         'PERCENTAGE'::"PromotionDiscountKind",1000,0,10,0,NULL,
         CURRENT_TIMESTAMP - INTERVAL '2 days',
         CURRENT_TIMESTAMP - INTERVAL '1 day',
         CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ('e2e_promotion_package_only','E2EPACK','Package Only E2E Promotion',
         'ACTIVE'::"PromotionStatus",'PACKAGE'::"PromotionScope",
         'PERCENTAGE'::"PromotionDiscountKind",1000,0,10,0,NULL,
         CURRENT_TIMESTAMP - INTERVAL '1 minute',
         CURRENT_TIMESTAMP + INTERVAL '1 day',
         CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ('e2e_promotion_minimum','E2EMIN','Minimum Spend E2E Promotion',
         'ACTIVE'::"PromotionStatus",'CAR'::"PromotionScope",
         'PERCENTAGE'::"PromotionDiscountKind",1000,200000,10,0,NULL,
         CURRENT_TIMESTAMP - INTERVAL '1 minute',
         CURRENT_TIMESTAMP + INTERVAL '1 day',
         CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
        ('e2e_promotion_limit','E2ELIMIT','Per Guest Limit E2E Promotion',
         'ACTIVE'::"PromotionStatus",'CAR'::"PromotionScope",
         'PERCENTAGE'::"PromotionDiscountKind",1000,0,10,1,1,
         CURRENT_TIMESTAMP - INTERVAL '1 minute',
         CURRENT_TIMESTAMP + INTERVAL '1 day',
         CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    `
  );

  await client.query(
    `
      INSERT INTO "CarQuote" (
        "id","tripType","originText","destinationText","startsAt","endsAt",
        "travellers","vehicleClassId","currency","subtotalMinor",
        "discountMinor","taxMinor","totalMinor","priceBreakdown","expiresAt",
        "createdAt"
      )
      VALUES
      (
        $1,'ONE_WAY'::"TripType",'Bhopal','Indore',
        CURRENT_TIMESTAMP + INTERVAL '7 days',
        CURRENT_TIMESTAMP + INTERVAL '7 days 5 hours',2,
        'e2e_assignment_class','INR',100000,0,0,100000,
        $3::jsonb,CURRENT_TIMESTAMP + INTERVAL '1 hour',CURRENT_TIMESTAMP
      ),
      (
        $2,'ONE_WAY'::"TripType",'Bhopal','Indore',
        CURRENT_TIMESTAMP + INTERVAL '8 days',
        CURRENT_TIMESTAMP + INTERVAL '8 days 5 hours',2,
        'e2e_assignment_class','INR',100000,0,0,100000,
        $4::jsonb,CURRENT_TIMESTAMP + INTERVAL '1 hour',CURRENT_TIMESTAMP
      )
    `,
    [
      quoteId,
      bookingQuoteId,
      JSON.stringify({
        source: "e2e-promotion-preview",
        basis: "FIXED",
      }),
      JSON.stringify({
        source: "e2e-promotion-booking",
        basis: "FIXED",
      }),
    ],
  );


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
        $1,'YAT-E2EPROMOLIMIT','e2e-promo-limit-idempotency-0001',
        'e2e-promo-limit-fingerprint','PENDING_REVIEW'::"BookingStatus",
        'ONE_WAY'::"TripType",'Bhopal','Indore',
        CURRENT_TIMESTAMP + INTERVAL '9 days',
        CURRENT_TIMESTAMP + INTERVAL '9 days 5 hours',2,
        'Promo Limit Guest','promo-limit@yatra.test',
        'e2e_assignment_class','INR',100000,10000,0,90000,
        $2::jsonb,$3::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [
      limitBookingId,
      JSON.stringify({
        source: "e2e-promotion-limit",
        subtotalMinor: "100000",
        discountMinor: "10000",
        taxMinor: "0",
        totalMinor: "90000",
        currency: "INR",
      }),
      JSON.stringify({
        source: "e2e-promotion-limit",
        code: "CAR_BOOKING",
        version: 1,
      }),
    ],
  );

  await client.query(
    `
      INSERT INTO "PromotionRedemption" (
        "id","promotionId","guestEmailNormalized","carBookingId",
        "currency","discountMinor","redeemedAt"
      )
      VALUES (
        'e2e_promotion_limit_redemption','e2e_promotion_limit',
        'promo-limit@yatra.test',$1,'INR',10000,CURRENT_TIMESTAMP
      )
    `,
    [limitBookingId],
  );

  await client.query("COMMIT");
  console.log("E2E promotion preview fixture ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
