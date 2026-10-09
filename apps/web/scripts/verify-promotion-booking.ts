import "dotenv/config";
import assert from "node:assert/strict";
import { getDb } from "@yatra/db/client";

async function main() {
  process.env.PROMOTION_APPLY_ENABLED = "true";
  
  const { createGuestCarBooking } = await import(
    "../src/modules/booking/car-booking-service"
  );
  
  const db = getDb();
  const promotionId = "e2e_promotion_preview";
  const quoteId = "e2e_promotion_booking_quote";
  const idempotencyKey = "e2e-promotion-booking-idempotency-0001";
  const guestEmail = "promo-booking@yatra.test";
  
  const activePolicies = await db.bookingPolicyVersion.findMany({
    where: {
      code: "CAR_BOOKING",
      status: "ACTIVE",
      OR: [
        { effectiveFrom: null },
        { effectiveFrom: { lte: new Date() } },
      ],
      AND: [
        {
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gt: new Date() } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  
  if (activePolicies.length === 0) {
    await db.bookingPolicyVersion.create({
      data: {
        id: "e2e_promotion_booking_policy",
        code: "CAR_BOOKING",
        version: 999,
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 60_000),
        document: {
          source: "e2e-promotion-booking",
          cancellation: "Fixture only",
        },
      },
    });
  } else if (activePolicies.length > 1) {
    throw new Error("Promotion booking verifier requires at most one active CAR_BOOKING policy.");
  }
  
  const first = await createGuestCarBooking({
    quoteId,
    idempotencyKey,
    guestName: "Promotion Booking E2E",
    guestEmail,
    promotionCode: " e2e10 ",
  });
  
  assert.equal(first.replayed, false);
  assert.equal(first.booking.subtotalMinor, "100000");
  assert.equal(first.booking.discountMinor, "10000");
  assert.equal(first.booking.totalMinor, "90000");
  
  const replay = await createGuestCarBooking({
    quoteId,
    idempotencyKey,
    guestName: "Promotion Booking E2E",
    guestEmail,
    promotionCode: "E2E10",
  });
  
  assert.equal(replay.replayed, true);
  assert.equal(replay.booking.reference, first.booking.reference);
  assert.equal(replay.booking.discountMinor, "10000");
  assert.equal(replay.booking.totalMinor, "90000");
  
  const promotion = await db.promotion.findUnique({
    where: { id: promotionId },
    select: { redeemedCount: true },
  });
  assert.equal(promotion?.redeemedCount, 1);
  
  const redemptionCount = await db.promotionRedemption.count({
    where: {
      promotionId,
      guestEmailNormalized: guestEmail,
    },
  });
  assert.equal(redemptionCount, 1);
  
  const booking = await db.carBooking.findUnique({
    where: { reference: first.booking.reference },
    select: {
      promotionId: true,
      promotionSnapshot: true,
      discountMinor: true,
      totalMinor: true,
    },
  });
  
  assert.equal(booking?.promotionId, promotionId);
  assert.equal(booking?.discountMinor, 10000n);
  assert.equal(booking?.totalMinor, 90000n);
  assert.ok(booking?.promotionSnapshot);
  assert.match(JSON.stringify(booking?.promotionSnapshot), /"code":"E2E10"/);
  
  console.log("Promotion booking integration verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
