import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const ssl = connectionString.includes("localhost")
  ? undefined
  : { rejectUnauthorized: false };

const promotionId = "e2e_promotion_race";
const promotionCode = "E2ERACE";
const bookings = [
  { id: "e2e_assignment_booking", email: "e2e-traveller@yatra.test" },
  { id: "e2e_lifecycle_booking", email: "e2e-lifecycle@yatra.test" },
];

async function client() {
  const value = new Client({ connectionString, ssl });
  await value.connect();
  return value;
}

const setup = await client();
try {
  await setup.query("BEGIN");
  await setup.query(
    `DELETE FROM "PromotionRedemption" WHERE "promotionId" = $1`,
    [promotionId],
  );
  await setup.query(`DELETE FROM "Promotion" WHERE "id" = $1 OR "code" = $2`, [
    promotionId,
    promotionCode,
  ]);
  await setup.query(
    `
      INSERT INTO "Promotion" (
        "id","code","name","status","scope","discountKind","percentageBps",
        "maxRedemptions","redeemedCount","activeFrom","createdAt","updatedAt"
      )
      VALUES (
        $1,$2,'E2E Redemption Race','ACTIVE'::"PromotionStatus",
        'CAR'::"PromotionScope",'PERCENTAGE'::"PromotionDiscountKind",1000,
        1,0,CURRENT_TIMESTAMP - INTERVAL '1 minute',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )
    `,
    [promotionId, promotionCode],
  );
  await setup.query("COMMIT");
} catch (error) {
  await setup.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await setup.end();
}

async function redeem(booking) {
  const db = await client();
  try {
    await db.query("BEGIN");
    const locked = await db.query(
      `
        SELECT "redeemedCount","maxRedemptions","status"
        FROM "Promotion"
        WHERE "id" = $1
        FOR UPDATE
      `,
      [promotionId],
    );

    if (locked.rowCount !== 1) throw new Error("promotion-missing");
    const row = locked.rows[0];
    if (row.status !== "ACTIVE") throw new Error("promotion-inactive");
    if (
      row.maxRedemptions !== null &&
      Number(row.redeemedCount) >= Number(row.maxRedemptions)
    ) {
      throw new Error("promotion-exhausted");
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    await db.query(
      `
        INSERT INTO "PromotionRedemption" (
          "id","promotionId","guestEmailNormalized","carBookingId",
          "currency","discountMinor","redeemedAt"
        )
        VALUES ($1,$2,$3,$4,'INR',1000,CURRENT_TIMESTAMP)
      `,
      [`e2e_redemption_${booking.id}`, promotionId, booking.email, booking.id],
    );

    await db.query(
      `UPDATE "Promotion" SET "redeemedCount" = "redeemedCount" + 1 WHERE "id" = $1`,
      [promotionId],
    );

    await db.query("COMMIT");
    return booking.id;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await db.end();
  }
}

const results = await Promise.allSettled(bookings.map((booking) => redeem(booking)));
const fulfilled = results.filter((result) => result.status === "fulfilled");
const rejected = results.filter((result) => result.status === "rejected");

if (fulfilled.length !== 1 || rejected.length !== 1) {
  throw new Error(
    `Expected one redemption success and one rejection; got ${fulfilled.length} success / ${rejected.length} rejection.`,
  );
}

const rejectionMessage =
  rejected[0].reason instanceof Error
    ? rejected[0].reason.message
    : String(rejected[0].reason);
if (rejectionMessage !== "promotion-exhausted") {
  throw new Error(`Unexpected losing redemption result: ${rejectionMessage}`);
}

const verify = await client();
try {
  const promotion = await verify.query(
    `SELECT "redeemedCount" FROM "Promotion" WHERE "id" = $1`,
    [promotionId],
  );
  const redemptions = await verify.query(
    `SELECT COUNT(*)::int AS count FROM "PromotionRedemption" WHERE "promotionId" = $1`,
    [promotionId],
  );

  if (Number(promotion.rows[0]?.redeemedCount) !== 1) {
    throw new Error("Promotion redeemedCount must equal exactly 1 after race.");
  }
  if (Number(redemptions.rows[0]?.count) !== 1) {
    throw new Error("Exactly one promotion redemption row must exist after race.");
  }

  console.log("Promotion redemption concurrency verification passed.");
} finally {
  await verify.end();
}
