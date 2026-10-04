import { randomUUID } from "node:crypto";
import { getDb, Prisma } from "@yatra/db/client";
import { createRazorpayOrder } from "@yatra/providers/payments/razorpay-client";

export type PaymentBookingType = "CAR" | "PACKAGE";

export class PaymentOrderServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "BOOKING_NOT_FOUND"
      | "BOOKING_NOT_PAYABLE"
      | "PAYMENT_ALREADY_CAPTURED"
      | "IDEMPOTENCY_CONFLICT"
      | "PROVIDER_ERROR",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "PaymentOrderServiceError";
  }
}

type BookingPaymentSource = {
  id: string;
  reference: string;
  status: string;
  currency: string;
  totalMinor: bigint;
};

async function findBooking(
  bookingType: PaymentBookingType,
  reference: string,
): Promise<BookingPaymentSource | null> {
  const db = getDb();

  if (bookingType === "CAR") {
    return db.carBooking.findUnique({
      where: { reference },
      select: {
        id: true,
        reference: true,
        status: true,
        currency: true,
        totalMinor: true,
      },
    });
  }

  return db.packageBooking.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      status: true,
      currency: true,
      totalMinor: true,
    },
  });
}

export async function createPaymentOrder(input: {
  bookingType: PaymentBookingType;
  bookingReference: string;
  idempotencyKey: string;
}) {
  const db = getDb();
  const booking = await findBooking(
    input.bookingType,
    input.bookingReference,
  );

  if (!booking) {
    throw new PaymentOrderServiceError(
      "Booking does not exist.",
      "BOOKING_NOT_FOUND",
      404,
    );
  }

  if (booking.status !== "PENDING_PAYMENT") {
    throw new PaymentOrderServiceError(
      "Booking is not awaiting payment.",
      "BOOKING_NOT_PAYABLE",
      409,
    );
  }

  if (booking.totalMinor <= 0n) {
    throw new PaymentOrderServiceError(
      "Booking does not require an online payment.",
      "BOOKING_NOT_PAYABLE",
      409,
    );
  }

  const existing = await db.paymentIntent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    const belongsToBooking =
      (input.bookingType === "CAR" &&
        existing.carBookingId === booking.id &&
        existing.packageBookingId === null) ||
      (input.bookingType === "PACKAGE" &&
        existing.packageBookingId === booking.id &&
        existing.carBookingId === null);

    if (
      !belongsToBooking ||
      existing.amountMinor !== booking.totalMinor ||
      existing.currency !== booking.currency
    ) {
      throw new PaymentOrderServiceError(
        "Idempotency key was used for a different payment request.",
        "IDEMPOTENCY_CONFLICT",
        409,
      );
    }

    if (existing.status === "CAPTURED") {
      throw new PaymentOrderServiceError(
        "Payment has already been captured.",
        "PAYMENT_ALREADY_CAPTURED",
        409,
      );
    }

    return {
      replayed: true,
      paymentIntentId: existing.id,
      providerOrderId: existing.providerOrderId,
      amountMinor: existing.amountMinor.toString(),
      currency: existing.currency,
      status: existing.status,
    };
  }

  const intentId = randomUUID();
  const receipt = `yatra_${booking.reference}`.slice(0, 40);

  try {
    const providerOrder = await createRazorpayOrder({
      amountMinor: booking.totalMinor,
      currency: booking.currency,
      receipt,
      notes: {
        bookingReference: booking.reference,
        bookingType: input.bookingType,
        paymentIntentId: intentId,
      },
    });

    if (
      BigInt(providerOrder.amount) !== booking.totalMinor ||
      providerOrder.currency !== booking.currency
    ) {
      throw new PaymentOrderServiceError(
        "Provider order amount/currency did not match booking.",
        "PROVIDER_ERROR",
        502,
      );
    }

    const intent = await db.paymentIntent.create({
      data: {
        id: intentId,
        provider: "RAZORPAY",
        status: "CREATED",
        idempotencyKey: input.idempotencyKey,
        carBookingId: input.bookingType === "CAR" ? booking.id : null,
        packageBookingId:
          input.bookingType === "PACKAGE" ? booking.id : null,
        providerOrderId: providerOrder.id,
        currency: booking.currency,
        amountMinor: booking.totalMinor,
        amountPaidMinor: BigInt(providerOrder.amount_paid ?? 0),
        receipt,
      },
    });

    return {
      replayed: false,
      paymentIntentId: intent.id,
      providerOrderId: intent.providerOrderId,
      amountMinor: intent.amountMinor.toString(),
      currency: intent.currency,
      status: intent.status,
    };
  } catch (error) {
    if (error instanceof PaymentOrderServiceError) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const replay = await db.paymentIntent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (replay) {
        return {
          replayed: true,
          paymentIntentId: replay.id,
          providerOrderId: replay.providerOrderId,
          amountMinor: replay.amountMinor.toString(),
          currency: replay.currency,
          status: replay.status,
        };
      }
    }

    throw new PaymentOrderServiceError(
      "Unable to create provider payment order.",
      "PROVIDER_ERROR",
      502,
    );
  }
}
