import { getDb, Prisma } from "@yatra/db/client";
import {
  assertBookingTransition,
  type BookingStatus,
} from "@yatra/domain/booking/status-machine";

export async function transitionCarBookingStatus(input: {
  bookingId: string;
  toStatus: BookingStatus;
  actorUserId?: string | null;
  reason?: string | null;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const booking = await tx.carBooking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, status: true },
      });

      if (!booking) {
        throw new Error("Car booking not found.");
      }

      assertBookingTransition(booking.status, input.toStatus);

      const now = new Date();

      const updated = await tx.carBooking.update({
        where: { id: booking.id },
        data: {
          status: input.toStatus,
          confirmedAt:
            input.toStatus === "CONFIRMED" ? now : undefined,
          completedAt:
            input.toStatus === "COMPLETED" ? now : undefined,
          cancelledAt:
            input.toStatus === "CANCELLED" ? now : undefined,
          statusHistory: {
            create: {
              fromStatus: booking.status,
              toStatus: input.toStatus,
              actorUserId: input.actorUserId ?? null,
              reason: input.reason?.trim().slice(0, 500) ?? null,
            },
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function transitionPackageBookingStatus(input: {
  bookingId: string;
  toStatus: BookingStatus;
  actorUserId?: string | null;
  reason?: string | null;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const booking = await tx.packageBooking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, status: true },
      });

      if (!booking) {
        throw new Error("Package booking not found.");
      }

      assertBookingTransition(booking.status, input.toStatus);

      const now = new Date();

      const updated = await tx.packageBooking.update({
        where: { id: booking.id },
        data: {
          status: input.toStatus,
          confirmedAt:
            input.toStatus === "CONFIRMED" ? now : undefined,
          completedAt:
            input.toStatus === "COMPLETED" ? now : undefined,
          cancelledAt:
            input.toStatus === "CANCELLED" ? now : undefined,
          statusHistory: {
            create: {
              fromStatus: booking.status,
              toStatus: input.toStatus,
              actorUserId: input.actorUserId ?? null,
              reason: input.reason?.trim().slice(0, 500) ?? null,
            },
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
