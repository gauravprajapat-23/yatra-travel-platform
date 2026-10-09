import { getDb, Prisma } from "@yatra/db/client";
import {
  assertBookingTransition,
  type BookingStatus,
} from "@yatra/domain/booking/status-machine";
import { releasePackageDepartureInventory } from "@/modules/packages/package-departure-inventory-service";

type BookingKind = "CAR" | "PACKAGE";

async function assertFinancialTransitionEvidence(
  tx: Prisma.TransactionClient,
  input: {
    kind: BookingKind;
    bookingId: string;
    totalMinor: bigint;
    toStatus: BookingStatus;
  },
) {
  const paymentWhere =
    input.kind === "CAR"
      ? { carBookingId: input.bookingId, packageBookingId: null }
      : { packageBookingId: input.bookingId, carBookingId: null };

  if (input.toStatus === "CONFIRMED" && input.totalMinor > 0n) {
    const captured = await tx.paymentIntent.findFirst({
      where: {
        ...paymentWhere,
        status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
        amountPaidMinor: { gte: input.totalMinor },
      },
      select: { id: true },
    });

    if (!captured) {
      throw new Error(
        "Paid bookings cannot be confirmed without captured payment evidence.",
      );
    }
  }

  if (input.toStatus === "REFUND_PENDING") {
    const pendingRefund = await tx.refund.findFirst({
      where: {
        status: "PENDING",
        paymentIntent: paymentWhere,
      },
      select: { id: true },
    });

    if (!pendingRefund) {
      throw new Error(
        "Booking cannot enter REFUND_PENDING without a pending refund record.",
      );
    }
  }

  if (input.toStatus === "REFUNDED") {
    const paymentIntents = await tx.paymentIntent.findMany({
      where: {
        ...paymentWhere,
        amountPaidMinor: { gt: 0n },
      },
      select: {
        amountPaidMinor: true,
        status: true,
        refunds: {
          where: { status: "PROCESSED" },
          select: { amountMinor: true },
        },
      },
    });

    const paidMinor = paymentIntents.reduce(
      (sum, intent) => sum + intent.amountPaidMinor,
      0n,
    );
    const refundedMinor = paymentIntents.reduce(
      (sum, intent) =>
        sum +
        intent.refunds.reduce(
          (refundSum, refund) => refundSum + refund.amountMinor,
          0n,
        ),
      0n,
    );

    if (
      paidMinor <= 0n ||
      refundedMinor < paidMinor ||
      paymentIntents.some((intent) => intent.status !== "REFUNDED")
    ) {
      throw new Error(
        "Booking cannot be marked REFUNDED until the payment ledger is fully refunded.",
      );
    }
  }
}

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
        select: {
          id: true,
          status: true,
          totalMinor: true,
        },
      });

      if (!booking) {
        throw new Error("Car booking not found.");
      }

      assertBookingTransition(booking.status, input.toStatus);

      await assertFinancialTransitionEvidence(tx, {
        kind: "CAR",
        bookingId: booking.id,
        totalMinor: booking.totalMinor,
        toStatus: input.toStatus,
      });

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
        select: {
          id: true,
          status: true,
          totalMinor: true,
          departureId: true,
          inventoryReleasedAt: true,
        },
      });

      if (!booking) {
        throw new Error("Package booking not found.");
      }

      assertBookingTransition(booking.status, input.toStatus);

      await assertFinancialTransitionEvidence(tx, {
        kind: "PACKAGE",
        bookingId: booking.id,
        totalMinor: booking.totalMinor,
        toStatus: input.toStatus,
      });

      const now = new Date();

      if (
        booking.departureId &&
        !booking.inventoryReleasedAt &&
        ["CANCELLED", "FAILED", "EXPIRED"].includes(input.toStatus)
      ) {
        await releasePackageDepartureInventory(tx, {
          bookingId: booking.id,
          at: now,
        });
      }

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
