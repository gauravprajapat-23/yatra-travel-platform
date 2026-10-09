import "dotenv/config";
import assert from "node:assert/strict";
import { getDb } from "@yatra/db/client";
import { createGuestCarBooking } from "../src/modules/booking/car-booking-service";

async function main() {
  const db = getDb();
  const quoteId = "e2e_car_customer_booking_quote";
  const idempotencyKey = "e2e-car-customer-idempotency-0001";

  await db.bookingStatusHistory.deleteMany({
    where: {
      booking: { idempotencyKey },
    },
  });
  await db.carBooking.deleteMany({
    where: { idempotencyKey },
  });
  await db.carQuote.deleteMany({
    where: { id: quoteId },
  });

  const activePolicies = await db.bookingPolicyVersion.findMany({
    where: {
      code: "CAR_BOOKING",
      status: "ACTIVE",
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
      AND: [
        {
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
      ],
    },
    select: { id: true },
  });

  if (activePolicies.length === 0) {
    await db.bookingPolicyVersion.create({
      data: {
        id: "e2e_car_customer_policy",
        code: "CAR_BOOKING",
        version: 1001,
        status: "ACTIVE",
        effectiveFrom: new Date(Date.now() - 60_000),
        activatedAt: new Date(),
        document: {
          source: "e2e-car-customer-flow",
          cancellation: "Fixture only",
        },
      },
    });
  } else if (activePolicies.length > 1) {
    throw new Error(
      "Car customer-flow verifier requires at most one active CAR_BOOKING policy.",
    );
  }

  const startsAt = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000);

  await db.carQuote.create({
    data: {
      id: quoteId,
      tripType: "ONE_WAY",
      originText: "Bhopal",
      destinationText: "Indore",
      startsAt,
      travellers: 2,
      vehicleClassId: "e2e_assignment_class",
      pricingRuleId: "e2e_car_customer_pricing",
      currency: "INR",
      subtotalMinor: 135000n,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: 135000n,
      priceBreakdown: {
        basis: "FIXED",
        baseAmountMinor: "125000",
        driverAllowanceMinor: "10000",
        nightAllowanceMinor: "0",
        tripDays: 1,
        selectedVehicleSlug: "e2e-assignment-vehicle",
      },
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  const first = await createGuestCarBooking({
    quoteId,
    idempotencyKey,
    guestName: "E2E Car Customer",
    guestEmail: "e2e-car-customer@yatra.test",
  });

  assert.equal(first.replayed, false);
  assert.equal(first.booking.subtotalMinor, "135000");
  assert.equal(first.booking.discountMinor, "0");
  assert.equal(first.booking.totalMinor, "135000");

  const replay = await createGuestCarBooking({
    quoteId,
    idempotencyKey,
    guestName: "E2E Car Customer",
    guestEmail: "e2e-car-customer@yatra.test",
  });

  assert.equal(replay.replayed, true);
  assert.equal(replay.booking.reference, first.booking.reference);

  const booking = await db.carBooking.findUniqueOrThrow({
    where: { reference: first.booking.reference },
    select: {
      quoteId: true,
      pricingRuleId: true,
      subtotalMinor: true,
      totalMinor: true,
      priceSnapshot: true,
    },
  });

  assert.equal(booking.quoteId, quoteId);
  assert.equal(booking.pricingRuleId, "e2e_car_customer_pricing");
  assert.equal(booking.subtotalMinor, 135000n);
  assert.equal(booking.totalMinor, 135000n);
  assert.match(JSON.stringify(booking.priceSnapshot), /"quoteId":"e2e_car_customer_booking_quote"/);

  const bookingCount = await db.carBooking.count({
    where: { idempotencyKey },
  });
  assert.equal(bookingCount, 1);

  console.log("Car customer booking integration verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
