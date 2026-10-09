import { Prisma } from "@yatra/db/client";

export const packageDepartureStatuses = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "SOLD_OUT",
  "CANCELLED",
  "COMPLETED",
] as const;

export type PackageDepartureStatusValue =
  (typeof packageDepartureStatuses)[number];

export function isPackageDepartureStatus(
  value: string,
): value is PackageDepartureStatusValue {
  return (packageDepartureStatuses as readonly string[]).includes(value);
}

export class PackageDepartureInventoryError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DEPARTURE_NOT_FOUND"
      | "DEPARTURE_NOT_OPEN"
      | "DEPARTURE_SALES_CLOSED"
      | "DEPARTURE_SOLD_OUT"
      | "DEPARTURE_PACKAGE_MISMATCH",
  ) {
    super(message);
    this.name = "PackageDepartureInventoryError";
  }
}

export function departureSnapshot(input: {
  id: string;
  packageId: string;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  capacityTravellers: number | null;
  salesOpenAt: Date | null;
  salesCloseAt: Date | null;
}) {
  return {
    departureId: input.id,
    packageId: input.packageId,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt?.toISOString() ?? null,
    status: input.status,
    capacityTravellers: input.capacityTravellers,
    salesOpenAt: input.salesOpenAt?.toISOString() ?? null,
    salesCloseAt: input.salesCloseAt?.toISOString() ?? null,
  } as const;
}

export async function reservePackageDepartureInventory(
  tx: Prisma.TransactionClient,
  input: {
    departureId: string;
    packageId: string;
    travellers: number;
    at?: Date;
  },
) {
  if (!Number.isInteger(input.travellers) || input.travellers <= 0) {
    throw new Error("Traveller inventory reservation must be a positive integer.");
  }

  const now = input.at ?? new Date();

  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "PackageDeparture"
    WHERE "id" = ${input.departureId}
    FOR UPDATE
  `;

  if (!locked[0]) {
    throw new PackageDepartureInventoryError(
      "Package departure does not exist.",
      "DEPARTURE_NOT_FOUND",
    );
  }

  const departure = await tx.packageDeparture.findUnique({
    where: { id: input.departureId },
  });

  if (!departure) {
    throw new PackageDepartureInventoryError(
      "Package departure does not exist.",
      "DEPARTURE_NOT_FOUND",
    );
  }

  if (departure.packageId !== input.packageId) {
    throw new PackageDepartureInventoryError(
      "Package departure does not belong to this package.",
      "DEPARTURE_PACKAGE_MISMATCH",
    );
  }

  if (departure.status !== "OPEN") {
    throw new PackageDepartureInventoryError(
      "Package departure is not open for booking.",
      departure.status === "SOLD_OUT"
        ? "DEPARTURE_SOLD_OUT"
        : "DEPARTURE_NOT_OPEN",
    );
  }

  if (
    (departure.salesOpenAt && now < departure.salesOpenAt) ||
    (departure.salesCloseAt && now >= departure.salesCloseAt) ||
    now >= departure.startsAt
  ) {
    throw new PackageDepartureInventoryError(
      "Package departure sales window is closed.",
      "DEPARTURE_SALES_CLOSED",
    );
  }

  if (
    departure.capacityTravellers !== null &&
    departure.reservedTravellers + input.travellers >
      departure.capacityTravellers
  ) {
    throw new PackageDepartureInventoryError(
      "Package departure does not have enough remaining traveller capacity.",
      "DEPARTURE_SOLD_OUT",
    );
  }

  const nextReserved = departure.reservedTravellers + input.travellers;
  const soldOut =
    departure.capacityTravellers !== null &&
    nextReserved >= departure.capacityTravellers;

  const updated = await tx.packageDeparture.update({
    where: { id: departure.id },
    data: {
      reservedTravellers: nextReserved,
      status: soldOut ? "SOLD_OUT" : undefined,
    },
  });

  return {
    departure: updated,
    snapshot: departureSnapshot(updated),
  };
}

export async function releasePackageDepartureInventory(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    at?: Date;
  },
) {
  const now = input.at ?? new Date();

  const locked = await tx.$queryRaw<
    Array<{
      id: string;
      departureId: string | null;
      travellers: number;
      inventoryReleasedAt: Date | null;
    }>
  >`
    SELECT "id", "departureId", "travellers", "inventoryReleasedAt"
    FROM "PackageBooking"
    WHERE "id" = ${input.bookingId}
    FOR UPDATE
  `;

  const booking = locked[0];
  if (!booking || !booking.departureId || booking.inventoryReleasedAt) {
    return { released: false };
  }

  await tx.$queryRaw`
    SELECT "id"
    FROM "PackageDeparture"
    WHERE "id" = ${booking.departureId}
    FOR UPDATE
  `;

  const departure = await tx.packageDeparture.findUnique({
    where: { id: booking.departureId },
  });

  if (!departure) {
    await tx.packageBooking.update({
      where: { id: booking.id },
      data: { inventoryReleasedAt: now },
    });
    return { released: false };
  }

  const nextReserved = Math.max(
    0,
    departure.reservedTravellers - booking.travellers,
  );

  const mayReopen =
    departure.status === "SOLD_OUT" &&
    departure.startsAt > now &&
    (!departure.salesOpenAt || departure.salesOpenAt <= now) &&
    (!departure.salesCloseAt || departure.salesCloseAt > now);

  await tx.packageDeparture.update({
    where: { id: departure.id },
    data: {
      reservedTravellers: nextReserved,
      status: mayReopen ? "OPEN" : undefined,
    },
  });

  await tx.packageBooking.update({
    where: { id: booking.id },
    data: { inventoryReleasedAt: now },
  });

  return {
    released: true,
    departureId: departure.id,
    reservedTravellers: nextReserved,
  };
}
