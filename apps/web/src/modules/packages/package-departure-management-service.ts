import { getDb, Prisma } from "@yatra/db/client";

export const packageDepartureAdminStatuses = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "SOLD_OUT",
  "CANCELLED",
  "COMPLETED",
] as const;

export type PackageDepartureAdminStatus =
  (typeof packageDepartureAdminStatuses)[number];

export function isPackageDepartureAdminStatus(
  value: string,
): value is PackageDepartureAdminStatus {
  return (packageDepartureAdminStatuses as readonly string[]).includes(value);
}

function assertDate(value: Date, label: string) {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`${label} is invalid.`);
  }
}

function assertDepartureInput(input: {
  startsAt: Date;
  endsAt: Date | null;
  salesOpenAt: Date | null;
  salesCloseAt: Date | null;
  capacityTravellers: number | null;
  reservedTravellers?: number;
}) {
  assertDate(input.startsAt, "Departure start");

  if (input.endsAt) {
    assertDate(input.endsAt, "Departure end");
    if (input.endsAt <= input.startsAt) {
      throw new Error("Departure end must be after its start.");
    }
  }

  if (input.salesOpenAt) assertDate(input.salesOpenAt, "Sales open");
  if (input.salesCloseAt) {
    assertDate(input.salesCloseAt, "Sales close");
    if (input.salesCloseAt > input.startsAt) {
      throw new Error("Sales must close no later than departure start.");
    }
  }
  if (
    input.salesOpenAt &&
    input.salesCloseAt &&
    input.salesOpenAt >= input.salesCloseAt
  ) {
    throw new Error("Sales open time must be before sales close time.");
  }

  if (
    input.capacityTravellers !== null &&
    (!Number.isInteger(input.capacityTravellers) ||
      input.capacityTravellers <= 0)
  ) {
    throw new Error("Departure capacity must be a positive whole number.");
  }

  if (
    input.capacityTravellers !== null &&
    input.reservedTravellers !== undefined &&
    input.capacityTravellers < input.reservedTravellers
  ) {
    throw new Error(
      "Departure capacity cannot be lower than already reserved travellers.",
    );
  }
}

export async function savePackageDeparture(input: {
  id?: string;
  packageId: string;
  startsAt: Date;
  endsAt: Date | null;
  status: PackageDepartureAdminStatus;
  capacityTravellers: number | null;
  salesOpenAt: Date | null;
  salesCloseAt: Date | null;
  notes: string;
  actorUserId: string;
}) {
  const db = getDb();
  const notes = input.notes.trim().slice(0, 2000) || null;

  return db.$transaction(
    async (tx) => {
      const pkg = await tx.tourPackage.findUnique({
        where: { id: input.packageId },
        select: { id: true, title: true },
      });
      if (!pkg) throw new Error("Package not found.");

      const current = input.id
        ? await tx.packageDeparture.findFirst({
            where: { id: input.id, packageId: input.packageId },
          })
        : null;

      if (input.id && !current) {
        throw new Error("Package departure not found.");
      }

      assertDepartureInput({
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        salesOpenAt: input.salesOpenAt,
        salesCloseAt: input.salesCloseAt,
        capacityTravellers: input.capacityTravellers,
        reservedTravellers: current?.reservedTravellers,
      });

      if (
        current &&
        current.reservedTravellers > 0 &&
        input.status === "CANCELLED" &&
        current.status !== "CANCELLED"
      ) {
        throw new Error(
          "A departure with reserved travellers cannot be cancelled until affected bookings are handled.",
        );
      }

      if (
        input.status === "SOLD_OUT" &&
        input.capacityTravellers !== null &&
        (current?.reservedTravellers ?? 0) < input.capacityTravellers
      ) {
        throw new Error(
          "SOLD_OUT can only be used when reserved travellers reach capacity.",
        );
      }

      const departure = current
        ? await tx.packageDeparture.update({
            where: { id: current.id },
            data: {
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              status: input.status,
              capacityTravellers: input.capacityTravellers,
              salesOpenAt: input.salesOpenAt,
              salesCloseAt: input.salesCloseAt,
              notes,
            },
          })
        : await tx.packageDeparture.create({
            data: {
              packageId: input.packageId,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              status: input.status,
              capacityTravellers: input.capacityTravellers,
              salesOpenAt: input.salesOpenAt,
              salesCloseAt: input.salesCloseAt,
              notes,
            },
          });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: current
            ? "PACKAGE_DEPARTURE_UPDATED"
            : "PACKAGE_DEPARTURE_CREATED",
          entityType: "PackageDeparture",
          entityId: departure.id,
          metadata: {
            packageId: input.packageId,
            status: departure.status,
            startsAt: departure.startsAt.toISOString(),
            endsAt: departure.endsAt?.toISOString() ?? null,
            capacityTravellers: departure.capacityTravellers,
            reservedTravellers: departure.reservedTravellers,
          },
        },
      });

      return departure;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function deletePackageDeparture(input: {
  departureId: string;
  packageId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const departure = await tx.packageDeparture.findFirst({
        where: {
          id: input.departureId,
          packageId: input.packageId,
        },
        include: {
          _count: {
            select: {
              quotes: true,
              bookings: true,
            },
          },
        },
      });

      if (!departure) throw new Error("Package departure not found.");
      if (departure.status !== "DRAFT") {
        throw new Error("Only draft departures can be deleted.");
      }
      if (
        departure.reservedTravellers > 0 ||
        departure._count.quotes > 0 ||
        departure._count.bookings > 0
      ) {
        throw new Error(
          "Departure cannot be deleted after inventory, quotes or bookings reference it.",
        );
      }

      await tx.packageDeparture.delete({
        where: { id: departure.id },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "PACKAGE_DEPARTURE_DELETED",
          entityType: "PackageDeparture",
          entityId: departure.id,
          metadata: {
            packageId: input.packageId,
            startsAt: departure.startsAt.toISOString(),
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
