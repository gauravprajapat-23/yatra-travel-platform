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
  tx: Prisma.TransactionClient,
  bookingType: PaymentBookingType,
  reference: string,
): Promise<BookingPaymentSource | null> {
  if (bookingType === "CAR") {
    return tx.carBooking.findUnique({
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

  return tx.packageBooking.findUnique({
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

function paymentIntentBelongsToBooking(
  bookingType: PaymentBookingType,
  bookingId: string,
  intent: {
    carBookingId: string | null;
    packageBookingId: string | null;
  },
): boolean {
  return bookingType === "CAR"
    ? intent.carBookingId === bookingId && intent.packageBookingId === null
    : intent.packageBookingId === bookingId && intent.carBookingId === null;
}

function replayResult(intent: {
  id: string;
  providerOrderId: string | null;
  amountMinor: bigint;
  currency: string;
  status: string;
}) {
  return {
    replayed: true,
    paymentIntentId: intent.id,
    providerOrderId: intent.providerOrderId,
    amountMinor: intent.amountMinor.toString(),
    currency: intent.currency,
    status: intent.status,
  };
}

export async function createPaymentOrder(input: {
  bookingType: PaymentBookingType;
  bookingReference: string;
  idempotencyKey: string;
}) {
  const db = getDb();
  const normalizedReference = input.bookingReference.trim().toUpperCase();
  const lockKey = `payment-order:${input.bookingType}:${normalizedReference}`;

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const booking = await findBooking(
        tx,
        input.bookingType,
        normalizedReference,
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

      const sameKey = await tx.paymentIntent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (sameKey) {
        if (
          !paymentIntentBelongsToBooking(
            input.bookingType,
            booking.id,
            sameKey,
          ) ||
          sameKey.amountMinor !== booking.totalMinor ||
          sameKey.currency !== booking.currency
        ) {
          throw new PaymentOrderServiceError(
            "Idempotency key was used for a different payment request.",
            "IDEMPOTENCY_CONFLICT",
            409,
          );
        }

        if (sameKey.status === "CAPTURED") {
          throw new PaymentOrderServiceError(
            "Payment has already been captured.",
            "PAYMENT_ALREADY_CAPTURED",
            409,
          );
        }

        if (
          sameKey.status === "CREATED" ||
          sameKey.status === "AUTHORIZED"
        ) {
          return replayResult(sameKey);
        }
      }

      const bookingIntentWhere =
        input.bookingType === "CAR"
          ? {
              carBookingId: booking.id,
              packageBookingId: null,
            }
          : {
              packageBookingId: booking.id,
              carBookingId: null,
            };

      const existingOpenIntent = await tx.paymentIntent.findFirst({
        where: {
          ...bookingIntentWhere,
          status: { in: ["CREATED", "AUTHORIZED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingOpenIntent) {
        if (
          existingOpenIntent.amountMinor !== booking.totalMinor ||
          existingOpenIntent.currency !== booking.currency
        ) {
          throw new PaymentOrderServiceError(
            "An existing payment order no longer matches the booking amount.",
            "IDEMPOTENCY_CONFLICT",
            409,
          );
        }

        return replayResult(existingOpenIntent);
      }

      const alreadyCaptured = await tx.paymentIntent.findFirst({
        where: {
          ...bookingIntentWhere,
          status: "CAPTURED",
        },
        select: { id: true },
      });

      if (alreadyCaptured) {
        throw new PaymentOrderServiceError(
          "Payment has already been captured.",
          "PAYMENT_ALREADY_CAPTURED",
          409,
        );
      }

      const intentId = randomUUID();
      const receipt = `yatra_${booking.reference}`.slice(0, 40);

      let providerOrder;
      try {
        providerOrder = await createRazorpayOrder({
          amountMinor: booking.totalMinor,
          currency: booking.currency,
          receipt,
          notes: {
            bookingReference: booking.reference,
            bookingType: input.bookingType,
            paymentIntentId: intentId,
          },
        });
      } catch {
        throw new PaymentOrderServiceError(
          "Unable to create provider payment order.",
          "PROVIDER_ERROR",
          502,
        );
      }

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

      const intent = await tx.paymentIntent.create({
        data: {
          id: intentId,
          provider: "RAZORPAY",
          status: "CREATED",
          idempotencyKey: input.idempotencyKey,
          carBookingId:
            input.bookingType === "CAR" ? booking.id : null,
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
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 20_000,
    },
  );
}
