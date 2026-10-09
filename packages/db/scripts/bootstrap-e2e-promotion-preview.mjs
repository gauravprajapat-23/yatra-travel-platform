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

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "PromotionRedemption" WHERE "promotionId" = $1`,
    [promotionId],
  );
  await client.query(
    `DELETE FROM "CarQuote" WHERE "id" IN ($1,$2)`,
    [quoteId, bookingQuoteId],
  );
  await client.query(
    `DELETE FROM "Promotion" WHERE "id" = $1 OR "code" = 'E2E10'`,
    [promotionId],
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

  await client.query("COMMIT");
  console.log("E2E promotion preview fixture ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
