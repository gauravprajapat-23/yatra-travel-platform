import { getDb, Prisma } from "@yatra/db/client";
import {
  bookingTimeWindow,
  credentialValidThrough,
  windowsOverlap,
} from "@yatra/domain/fleet/availability";

const activeBookingStatuses = [
  "CONFIRMED",
  "DRIVER_ASSIGNED",
  "IN_PROGRESS",
] as const;

export async function assignCarBookingResources(input: {
  bookingId: string;
  vehicleId: string;
  driverId: string;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const booking = await tx.carBooking.findUnique({
        where: { id: input.bookingId },
        select: {
          id: true,
          reference: true,
          status: true,
          vehicleClassId: true,
          startsAt: true,
          endsAt: true,
        },
      });

      if (!booking) throw new Error("Car booking not found.");
      if (!["CONFIRMED", "DRIVER_ASSIGNED"].includes(booking.status)) {
        throw new Error("Booking must be confirmed before assignment.");
      }

      const [vehicle, driverQualification] = await Promise.all([
        tx.vehicle.findUnique({
          where: { id: input.vehicleId },
          select: {
            id: true,
            status: true,
            vehicleClassId: true,
            displayName: true,
          },
        }),
        tx.driverVehicleClass.findUnique({
          where: {
            driverId_vehicleClassId: {
              driverId: input.driverId,
              vehicleClassId: booking.vehicleClassId,
            },
          },
          include: {
            driver: {
              select: {
                id: true,
                status: true,
                displayName: true,
                licenseExpiry: true,
              },
            },
          },
        }),
      ]);

      if (
        !vehicle ||
        vehicle.status !== "ACTIVE" ||
        vehicle.vehicleClassId !== booking.vehicleClassId
      ) {
        throw new Error("Selected vehicle is not active or does not match the booking class.");
      }

      if (!driverQualification || driverQualification.driver.status !== "ACTIVE") {
        throw new Error("Selected driver is not active or qualified for this vehicle class.");
      }

      const tripWindow = bookingTimeWindow(
        booking.startsAt,
        booking.endsAt,
      );
      const tripStart = tripWindow.startsAt;
      const tripEnd = tripWindow.endsAt;

      if (
        !credentialValidThrough(
          driverQualification.driver.licenseExpiry,
          tripEnd,
        )
      ) {
        throw new Error(
          "Selected driver's license does not remain valid through the trip.",
        );
      }

      const [
        vehicleBlock,
        driverBlock,
        complianceBlocker,
        vehicleBookings,
        driverBookings,
      ] = await Promise.all([
        tx.vehicleAvailabilityBlock.findFirst({
          where: {
            vehicleId: vehicle.id,
            startsAt: { lt: tripEnd },
            endsAt: { gt: tripStart },
          },
          select: { id: true },
        }),
        tx.driverAvailabilityBlock.findFirst({
          where: {
            driverId: driverQualification.driver.id,
            startsAt: { lt: tripEnd },
            endsAt: { gt: tripStart },
          },
          select: { id: true },
        }),
        tx.vehicleComplianceDocument.findFirst({
          where: {
            vehicleId: vehicle.id,
            blocksDispatch: true,
            expiresAt: { not: null, lte: tripEnd },
          },
          orderBy: { expiresAt: "asc" },
          select: {
            id: true,
            type: true,
            label: true,
            expiresAt: true,
          },
        }),
        tx.carBooking.findMany({
          where: {
            id: { not: booking.id },
            selectedVehicleId: vehicle.id,
            status: { in: [...activeBookingStatuses] },
            startsAt: { lt: tripEnd },
          },
          select: { startsAt: true, endsAt: true },
        }),
        tx.carBooking.findMany({
          where: {
            id: { not: booking.id },
            assignedDriverId: driverQualification.driver.id,
            status: { in: [...activeBookingStatuses] },
            startsAt: { lt: tripEnd },
          },
          select: { startsAt: true, endsAt: true },
        }),
      ]);

      if (vehicleBlock) {
        throw new Error("Selected vehicle is blocked for this trip window.");
      }
      if (complianceBlocker) {
        throw new Error(
          `Selected vehicle has a dispatch-blocking compliance document that does not remain valid through the trip: ${complianceBlocker.label}.`,
        );
      }
      if (driverBlock) {
        throw new Error("Selected driver is unavailable for this trip window.");
      }

      const vehicleConflict = vehicleBookings.some((other) =>
        windowsOverlap(
          tripWindow,
          bookingTimeWindow(other.startsAt, other.endsAt),
        ),
      );
      if (vehicleConflict) throw new Error("Selected vehicle already has an overlapping booking.");

      const driverConflict = driverBookings.some((other) =>
        windowsOverlap(
          tripWindow,
          bookingTimeWindow(other.startsAt, other.endsAt),
        ),
      );
      if (driverConflict) throw new Error("Selected driver already has an overlapping booking.");

      const movingToAssigned = booking.status === "CONFIRMED";

      const updated = await tx.carBooking.update({
        where: { id: booking.id },
        data: {
          selectedVehicleId: vehicle.id,
          assignedDriverId: driverQualification.driver.id,
          status: movingToAssigned ? "DRIVER_ASSIGNED" : undefined,
          statusHistory: movingToAssigned
            ? {
                create: {
                  fromStatus: "CONFIRMED",
                  toStatus: "DRIVER_ASSIGNED",
                  actorUserId: input.actorUserId,
                  reason: "Vehicle and driver assigned by operations.",
                },
              }
            : undefined,
        },
      });

      return {
        booking: updated,
        vehicleName: vehicle.displayName,
        driverName: driverQualification.driver.displayName,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
