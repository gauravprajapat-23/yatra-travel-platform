import "dotenv/config";
import assert from "node:assert/strict";
import { getDb, Prisma } from "@yatra/db/client";
import { departureSnapshot, releasePackageDepartureInventory } from "../src/modules/packages/package-departure-inventory-service";
import { createGuestPackageBooking } from "../src/modules/booking/package-booking-service";
import { transitionPackageBookingStatus } from "../src/modules/booking/booking-status-service";

async function main() {
  const db = getDb();
  const packageId = "e2e_departure_package";
  const priceOptionId = "e2e_departure_price";
  const departureId = "e2e_departure_open";
  const quoteId = "e2e_departure_booking_quote";
  const idempotencyKey = "e2e-departure-booking-idempotency-0001";

  await db.packageBookingStatusHistory.deleteMany({
    where: { booking: { packageId } },
  });
  await db.packageBooking.deleteMany({
    where: { packageId, idempotencyKey },
  });
  await db.packageQuote.deleteMany({
    where: { id: quoteId },
  });
  await db.packageDeparture.update({
    where: { id: departureId },
    data: {
      status: "OPEN",
      reservedTravellers: 0,
    },
  });

  const departure = await db.packageDeparture.findUniqueOrThrow({
    where: { id: departureId },
  });
  const price = await db.packagePriceOption.findUniqueOrThrow({
    where: { id: priceOptionId },
  });

  const travellers = 2;
  const subtotalMinor = price.amountMinor * BigInt(travellers);

  await db.packageQuote.create({
    data: {
      id: quoteId,
      packageId,
      priceOptionId,
      travellers,
      vehicleCount: null,
      quantity: travellers,
      travelStartAt: departure.startsAt,
      departureId,
      departureSnapshot: departureSnapshot(departure) as Prisma.InputJsonValue,
      currency: price.currency,
      subtotalMinor,
      discountMinor: 0n,
      taxMinor: 0n,
      totalMinor: subtotalMinor,
      priceBreakdown: {
        mode: price.mode,
        amountMinor: price.amountMinor.toString(),
        quantity: travellers,
        travellers,
        vehicleCount: null,
        departureId,
      },
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });

  const first = await createGuestPackageBooking({
    quoteId,
    idempotencyKey,
    guestName: "Departure Booking E2E",
    guestEmail: "departure-booking@yatra.test",
  });

  assert.equal(first.replayed, false);
  assert.equal(first.booking.travellers, 2);
  assert.equal(first.booking.subtotalMinor, "500000");
  assert.equal(first.booking.totalMinor, "500000");

  let currentDeparture = await db.packageDeparture.findUniqueOrThrow({
    where: { id: departureId },
  });
  assert.equal(currentDeparture.reservedTravellers, 2);
  assert.equal(currentDeparture.status, "OPEN");

  const replay = await createGuestPackageBooking({
    quoteId,
    idempotencyKey,
    guestName: "Departure Booking E2E",
    guestEmail: "departure-booking@yatra.test",
  });

  assert.equal(replay.replayed, true);
  assert.equal(replay.booking.reference, first.booking.reference);

  currentDeparture = await db.packageDeparture.findUniqueOrThrow({
    where: { id: departureId },
  });
  assert.equal(currentDeparture.reservedTravellers, 2);

  const booking = await db.packageBooking.findUniqueOrThrow({
    where: { reference: first.booking.reference },
    select: {
      id: true,
      departureId: true,
      departureSnapshot: true,
      inventoryReleasedAt: true,
    },
  });

  assert.equal(booking.departureId, departureId);
  assert.ok(booking.departureSnapshot);
  assert.equal(booking.inventoryReleasedAt, null);

  await transitionPackageBookingStatus({
    bookingId: booking.id,
    toStatus: "CANCELLED",
    reason: "E2E inventory release certification",
  });

  currentDeparture = await db.packageDeparture.findUniqueOrThrow({
    where: { id: departureId },
  });
  assert.equal(currentDeparture.reservedTravellers, 0);
  assert.equal(currentDeparture.status, "OPEN");

  const cancelled = await db.packageBooking.findUniqueOrThrow({
    where: { id: booking.id },
    select: { inventoryReleasedAt: true },
  });
  assert.ok(cancelled.inventoryReleasedAt);

  const secondRelease = await db.$transaction(
    (tx) =>
      releasePackageDepartureInventory(tx, {
        bookingId: booking.id,
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  assert.equal(secondRelease.released, false);

  currentDeparture = await db.packageDeparture.findUniqueOrThrow({
    where: { id: departureId },
  });
  assert.equal(currentDeparture.reservedTravellers, 0);

  console.log("Package departure booking integration verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
