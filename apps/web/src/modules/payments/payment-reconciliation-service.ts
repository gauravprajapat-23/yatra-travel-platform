import { getDb, Prisma } from "@yatra/db/client";
import {
  fetchRazorpayPayment,
} from "@yatra/providers/payments/razorpay-client";
import {
  verifyRazorpayPaymentSignature,
} from "@yatra/providers/payments/razorpay-signature";

export class PaymentReconciliationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PAYMENT_INTENT_NOT_FOUND"
      | "PAYMENT_INTENT_NOT_READY"
      | "INVALID_SIGNATURE"
      | "PROVIDER_PAYMENT_MISMATCH"
      | "PAYMENT_NOT_CAPTURED",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "PaymentReconciliationError";
  }
}

function assertPaymentMatchesIntent(input: {
  payment: {
    id: string;
    amount: number;
    currency: string;
    order_id: string | null;
    captured: boolean;
  };
  providerOrderId: string;
  amountMinor: bigint;
  currency: string;
}) {
  if (input.payment.order_id !== input.providerOrderId) {
    throw new PaymentReconciliationError(
      "Provider payment order id did not match stored order id.",
      "PROVIDER_PAYMENT_MISMATCH",
      409,
    );
  }

  if (BigInt(input.payment.amount) !== input.amountMinor) {
    throw new PaymentReconciliationError(
      "Provider payment amount did not match stored booking amount.",
      "PROVIDER_PAYMENT_MISMATCH",
      409,
    );
  }

  if (input.payment.currency !== input.currency) {
    throw new PaymentReconciliationError(
      "Provider payment currency did not match stored booking currency.",
      "PROVIDER_PAYMENT_MISMATCH",
      409,
    );
  }
}

async function confirmBookingFromPayment(
  tx: Prisma.TransactionClient,
  intent: {
    carBookingId: string | null;
    packageBookingId: string | null;
  },
) {
  if (intent.carBookingId) {
    const booking = await tx.carBooking.findUnique({
      where: { id: intent.carBookingId },
      select: { id: true, status: true },
    });

    if (booking?.status === "PENDING_PAYMENT") {
      await tx.carBooking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          statusHistory: {
            create: {
              fromStatus: "PENDING_PAYMENT",
              toStatus: "CONFIRMED",
              reason: "Payment captured and reconciled.",
            },
          },
        },
      });
    }

    return;
  }

  if (intent.packageBookingId) {
    const booking = await tx.packageBooking.findUnique({
      where: { id: intent.packageBookingId },
      select: { id: true, status: true },
    });

    if (booking?.status === "PENDING_PAYMENT") {
      await tx.packageBooking.update({
        where: { id: booking.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
          statusHistory: {
            create: {
              fromStatus: "PENDING_PAYMENT",
              toStatus: "CONFIRMED",
              reason: "Payment captured and reconciled.",
            },
          },
        },
      });
    }
  }
}

export async function reconcileVerifiedRazorpayPayment(input: {
  paymentIntentId: string;
  paymentId: string;
  signature: string;
}) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    throw new PaymentReconciliationError(
      "Payment provider is not configured.",
      "PAYMENT_INTENT_NOT_READY",
      503,
    );
  }

  const db = getDb();

  const intent = await db.paymentIntent.findUnique({
    where: { id: input.paymentIntentId },
  });

  if (!intent) {
    throw new PaymentReconciliationError(
      "Payment intent does not exist.",
      "PAYMENT_INTENT_NOT_FOUND",
      404,
    );
  }

  if (!intent.providerOrderId) {
    throw new PaymentReconciliationError(
      "Payment intent does not have a provider order.",
      "PAYMENT_INTENT_NOT_READY",
      409,
    );
  }

  if (
    !verifyRazorpayPaymentSignature({
      orderId: intent.providerOrderId,
      paymentId: input.paymentId,
      signature: input.signature,
      keySecret,
    })
  ) {
    throw new PaymentReconciliationError(
      "Payment signature verification failed.",
      "INVALID_SIGNATURE",
      401,
    );
  }

  const payment = await fetchRazorpayPayment(input.paymentId);

  assertPaymentMatchesIntent({
    payment,
    providerOrderId: intent.providerOrderId,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
  });

  if (!payment.captured || payment.status !== "captured") {
    throw new PaymentReconciliationError(
      "Payment is not captured.",
      "PAYMENT_NOT_CAPTURED",
      409,
    );
  }

  const result = await db.$transaction(
    async (tx) => {
      const freshIntent = await tx.paymentIntent.findUnique({
        where: { id: intent.id },
      });

      if (!freshIntent) {
        throw new PaymentReconciliationError(
          "Payment intent disappeared during reconciliation.",
          "PAYMENT_INTENT_NOT_FOUND",
          404,
        );
      }

      if (
        freshIntent.status === "CAPTURED" &&
        freshIntent.providerPaymentId === payment.id
      ) {
        return freshIntent;
      }

      const updated = await tx.paymentIntent.update({
        where: { id: freshIntent.id },
        data: {
          status: "CAPTURED",
          providerPaymentId: payment.id,
          amountPaidMinor: BigInt(payment.amount),
          capturedAt: new Date(),
        },
      });

      await confirmBookingFromPayment(tx, updated);

      return updated;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return {
    paymentIntentId: result.id,
    status: result.status,
    providerOrderId: result.providerOrderId,
    providerPaymentId: result.providerPaymentId,
    amountPaidMinor: result.amountPaidMinor.toString(),
    currency: result.currency,
  };
}
