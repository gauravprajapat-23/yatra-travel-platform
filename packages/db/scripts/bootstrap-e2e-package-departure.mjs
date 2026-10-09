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
  package: "e2e_departure_package",
  price: "e2e_departure_price",
  open: "e2e_departure_open",
  closed: "e2e_departure_closed",
  soldOut: "e2e_departure_soldout",
};

await client.connect();

try {
  await client.query("BEGIN");

  await client.query(
    `DELETE FROM "PackageBookingStatusHistory"
     WHERE "bookingId" IN (
       SELECT "id" FROM "PackageBooking" WHERE "packageId" = $1
     )`,
    [ids.package],
  );
  await client.query(
    `DELETE FROM "PromotionRedemption"
     WHERE "packageBookingId" IN (
       SELECT "id" FROM "PackageBooking" WHERE "packageId" = $1
     )`,
    [ids.package],
  );
  await client.query(
    `DELETE FROM "PaymentIntent"
     WHERE "packageBookingId" IN (
       SELECT "id" FROM "PackageBooking" WHERE "packageId" = $1
     )`,
    [ids.package],
  );
  await client.query(`DELETE FROM "PackageBooking" WHERE "packageId" = $1`, [ids.package]);
  await client.query(`DELETE FROM "PackageQuote" WHERE "packageId" = $1`, [ids.package]);
  await client.query(`DELETE FROM "PackageDeparture" WHERE "packageId" = $1`, [ids.package]);
  await client.query(`DELETE FROM "PackagePriceOption" WHERE "packageId" = $1`, [ids.package]);
  await client.query(`DELETE FROM "PackageItineraryDay" WHERE "packageId" = $1`, [ids.package]);
  await client.query(`DELETE FROM "PackageDestination" WHERE "packageId" = $1`, [ids.package]);
  await client.query(`DELETE FROM "TourPackage" WHERE "id" = $1 OR "slug" = 'e2e-departure-package'`, [ids.package]);

  await client.query(
    `
      INSERT INTO "TourPackage" (
        "id","slug","title","summary","body","status","durationDays","durationNights",
        "publishedAt","robotsIndex","robotsFollow","createdAt","updatedAt"
      )
      VALUES (
        $1,'e2e-departure-package','E2E Departure Journey',
        'Disposable package used for departure inventory certification.',
        $2::jsonb,'PUBLISHED'::"ContentStatus",3,2,
        CURRENT_TIMESTAMP,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.package, JSON.stringify([{ type: "paragraph", text: "E2E departure package." }])],
  );

  await client.query(
    `
      INSERT INTO "PackagePriceOption" (
        "id","packageId","mode","currency","amountMinor","minTravellers","maxTravellers",
        "isActive","sortOrder","createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'PER_PERSON'::"PackagePriceMode",'INR',250000,1,4,
        true,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [ids.price, ids.package],
  );

  await client.query(
    `
      INSERT INTO "PackageDeparture" (
        "id","packageId","startsAt","endsAt","status","capacityTravellers",
        "reservedTravellers","salesOpenAt","salesCloseAt","notes","createdAt","updatedAt"
      )
      VALUES
        (
          $1,$4,CURRENT_TIMESTAMP + INTERVAL '21 days',
          CURRENT_TIMESTAMP + INTERVAL '24 days','OPEN'::"PackageDepartureStatus",
          3,0,CURRENT_TIMESTAMP - INTERVAL '1 day',
          CURRENT_TIMESTAMP + INTERVAL '20 days',
          'Sellable E2E departure',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        ),
        (
          $2,$4,CURRENT_TIMESTAMP + INTERVAL '28 days',
          CURRENT_TIMESTAMP + INTERVAL '31 days','CLOSED'::"PackageDepartureStatus",
          3,0,CURRENT_TIMESTAMP - INTERVAL '1 day',
          CURRENT_TIMESTAMP + INTERVAL '27 days',
          'Closed E2E departure',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        ),
        (
          $3,$4,CURRENT_TIMESTAMP + INTERVAL '35 days',
          CURRENT_TIMESTAMP + INTERVAL '38 days','SOLD_OUT'::"PackageDepartureStatus",
          2,2,CURRENT_TIMESTAMP - INTERVAL '1 day',
          CURRENT_TIMESTAMP + INTERVAL '34 days',
          'Sold out E2E departure',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        )
    `,
    [ids.open, ids.closed, ids.soldOut, ids.package],
  );

  const activePolicy = await client.query(
    `
      SELECT "id"
      FROM "BookingPolicyVersion"
      WHERE "code" = 'PACKAGE_BOOKING'
        AND "status" = 'ACTIVE'::"BookingPolicyStatus"
        AND ("effectiveFrom" IS NULL OR "effectiveFrom" <= CURRENT_TIMESTAMP)
        AND ("effectiveTo" IS NULL OR "effectiveTo" > CURRENT_TIMESTAMP)
      LIMIT 2
    `,
  );

  if (activePolicy.rowCount === 0) {
    await client.query(
      `
        INSERT INTO "BookingPolicyVersion" (
          "id","code","version","status","effectiveFrom","activatedAt",
          "document","createdAt","updatedAt"
        )
        VALUES (
          'e2e_departure_policy','PACKAGE_BOOKING',999,
          'ACTIVE'::"BookingPolicyStatus",
          CURRENT_TIMESTAMP - INTERVAL '1 minute',CURRENT_TIMESTAMP,
          $1::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        )
      `,
      [JSON.stringify({ source: "e2e-package-departure", version: 999 })],
    );
  } else if (activePolicy.rowCount > 1) {
    throw new Error("Expected at most one active PACKAGE_BOOKING policy.");
  }

  await client.query("COMMIT");
  console.log("E2E package departure fixture ready.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
