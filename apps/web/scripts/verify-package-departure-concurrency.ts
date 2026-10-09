import "dotenv/config";
import assert from "node:assert/strict";
import { getDb, Prisma } from "@yatra/db/client";
import {
  PackageDepartureInventoryError,
  reservePackageDepartureInventory,
} from "../src/modules/packages/package-departure-inventory-service";

async function main() {
  const db = getDb();
  const packageId = "e2e_departure_inventory_package";
  const departureId = "e2e_departure_inventory_one_seat";

  await db.$transaction(async (tx) => {
    await tx.packageDeparture.deleteMany({
      where: { id: departureId },
    });
    await tx.tourPackage.deleteMany({
      where: { id: packageId },
    });

    await tx.tourPackage.create({
      data: {
        id: packageId,
        slug: "e2e-departure-inventory-package",
        title: "E2E Departure Inventory Package",
        summary: "Disposable inventory concurrency fixture.",
        body: [],
        status: "DRAFT",
        durationDays: 2,
        durationNights: 1,
      },
    });

    await tx.packageDeparture.create({
      data: {
        id: departureId,
        packageId,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
        status: "OPEN",
        capacityTravellers: 1,
        reservedTravellers: 0,
        salesOpenAt: new Date(Date.now() - 60_000),
        salesCloseAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      },
    });
  });

  const reserve = () =>
    db.$transaction(
      (tx) =>
        reservePackageDepartureInventory(tx, {
          departureId,
          packageId,
          travellers: 1,
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  const results = await Promise.allSettled([reserve(), reserve()]);
  const fulfilled = results.filter(
    (result) => result.status === "fulfilled",
  );
  const rejected = results.filter(
    (result) => result.status === "rejected",
  );

  assert.equal(
    fulfilled.length,
    1,
    "Exactly one concurrent departure reservation must succeed.",
  );
  assert.equal(
    rejected.length,
    1,
    "Exactly one concurrent departure reservation must be rejected.",
  );

  const rejection = rejected[0];
  assert.equal(rejection.status, "rejected");

  const safeInventoryRejection =
    rejection.reason instanceof PackageDepartureInventoryError &&
    rejection.reason.code === "DEPARTURE_SOLD_OUT";
  const rejectionCode =
    typeof rejection.reason === "object" &&
    rejection.reason !== null &&
    "code" in rejection.reason &&
    typeof rejection.reason.code === "string"
      ? rejection.reason.code
      : null;
  const rejectionMessage =
    rejection.reason instanceof Error
      ? rejection.reason.message
      : String(rejection.reason ?? "");

  const safeSerializationRejection =
    rejectionCode === "P2034" ||
    /could not serialize access|serialization failure|write conflict|deadlock/i.test(
      rejectionMessage,
    );

  assert.ok(
    safeInventoryRejection || safeSerializationRejection,
    "Losing reservation must be rejected as sold-out or by serializable concurrency control.",
  );

  const departure = await db.packageDeparture.findUnique({
    where: { id: departureId },
  });
  assert.equal(departure?.reservedTravellers, 1);
  assert.equal(departure?.status, "SOLD_OUT");

  console.log("Package departure concurrency verification passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
