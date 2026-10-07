import { getDb, Prisma } from "@yatra/db/client";
import {
  createRazorpayRefund,
  type RazorpayRefund,
} from "@yatra/providers/payments/razorpay-client";

export class RefundServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "REFUNDS_DISABLED"
      | "PAYMENT_INTENT_NOT_FOUND"
      | "PAYMENT_NOT_REFUNDABLE"
      | "INVALID_REFUND_AMOUNT"
      | "IDEMPOTENCY_CONFLICT"
      | "REFUND_CONFLICT"
      | "PROVIDER_ERROR"
      | "RECONCILIATION_PENDING",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "RefundServiceError";
  }
}

function replayResult(refund: {
  id: string;
  status: string;
  providerRefundId: string | null;
  amountMinor: bigint;
  currency: string;
}) {
  return {
    replayed: true,
    refundId: refund.id,
    status: refund.status,
    providerRefundId: refund.providerRefundId,
    amountMinor: refund.amountMinor.toString(),
    currency: refund.currency,
  };
}

export async function createRefundRequest(input: {
  paymentIntentId: string;
  amountMinor: bigint;
  idempotencyKey: string;
  reason?: string;
}) {
  if (process.env.REFUND_WRITE_ENABLED !== "true") {
    throw new RefundServiceError(
      "Refund creation is not enabled.",
      "REFUNDS_DISABLED",
      503,
    );
  }

  if (input.amountMinor <= 0n) {
    throw new RefundServiceError(
      "Refund amount must be positive.",
      "INVALID_REFUND_AMOUNT",
      400,
    );
  }

  const db = getDb();

  let reservation:
    | {
        kind: "replay";
        refund: {
          id: string;
          status: string;
          providerRefundId: string | null;
          amountMinor: bigint;
          currency: string;
          paymentIntentId: string;
        };
      }
    | {
        kind: "created";
        refund: {
          id: string;
          status: string;
          providerRefundId: string | null;
          amountMinor: bigint;
          currency: string;
        };
        providerPaymentId: string;
        paymentIntentId: string;
      };

  try {
    reservation = await db.$transaction(
      async (tx) => {
        const existing = await tx.refund.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existing) {
          if (
            existing.paymentIntentId !== input.paymentIntentId ||
            existing.amountMinor !== input.amountMinor
          ) {
            throw new RefundServiceError(
              "Idempotency key was used for a different refund request.",
              "IDEMPOTENCY_CONFLICT",
              409,
            );
          }

          return {
            kind: "replay" as const,
            refund: existing,
          };
        }

        const paymentIntent = await tx.paymentIntent.findUnique({
          where: { id: input.paymentIntentId },
        });

        if (
          !paymentIntent ||
          !paymentIntent.providerPaymentId ||
          !["CAPTURED", "PARTIALLY_REFUNDED"].includes(paymentIntent.status)
        ) {
          throw new RefundServiceError(
            "Payment is not refundable.",
            "PAYMENT_NOT_REFUNDABLE",
            409,
          );
        }

        const reserved = await tx.refund.aggregate({
          where: {
            paymentIntentId: paymentIntent.id,
            status: { in: ["PENDING", "PROCESSED"] },
          },
          _sum: { amountMinor: true },
        });

        const reservedMinor = reserved._sum.amountMinor ?? 0n;
        const remainingMinor = paymentIntent.amountPaidMinor - reservedMinor;

        if (input.amountMinor > remainingMinor) {
          throw new RefundServiceError(
            "Refund amount exceeds the remaining refundable amount.",
            "INVALID_REFUND_AMOUNT",
            409,
          );
        }

        const refund = await tx.refund.create({
          data: {
            paymentIntentId: paymentIntent.id,
            provider: "RAZORPAY",
            status: "PENDING",
            idempotencyKey: input.idempotencyKey,
            currency: paymentIntent.currency,
            amountMinor: input.amountMinor,
            reason: input.reason?.trim().slice(0, 500) || null,
          },
        });

        return {
          kind: "created" as const,
          refund,
          providerPaymentId: paymentIntent.providerPaymentId,
          paymentIntentId: paymentIntent.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof RefundServiceError) throw error;

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;

    if (code === "P2002") {
      const existing = await db.refund.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (existing) {
        if (
          existing.paymentIntentId !== input.paymentIntentId ||
          existing.amountMinor !== input.amountMinor
        ) {
          throw new RefundServiceError(
            "Idempotency key was used for a different refund request.",
            "IDEMPOTENCY_CONFLICT",
            409,
          );
        }

        return replayResult(existing);
      }
    }

    if (code === "P2034") {
      throw new RefundServiceError(
        "Refund balance changed during this request. Retry with a fresh balance.",
        "REFUND_CONFLICT",
        409,
      );
    }

    throw error;
  }

  if (reservation.kind === "replay") {
    return replayResult(reservation.refund);
  }

  const {
    refund,
    providerPaymentId,
    paymentIntentId,
  } = reservation;

  let providerRefund: RazorpayRefund;

  try {
    providerRefund = await createRazorpayRefund({
      paymentId: providerPaymentId,
      amountMinor: refund.amountMinor,
      notes: {
        refundId: refund.id,
        paymentIntentId,
      },
    });
  } catch {
    await db.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED" },
    });

    throw new RefundServiceError(
      "Razorpay refund request failed.",
      "PROVIDER_ERROR",
      502,
    );
  }

  if (
    providerRefund.payment_id !== providerPaymentId ||
    BigInt(providerRefund.amount) !== refund.amountMinor ||
    providerRefund.currency !== refund.currency
  ) {
    await db.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: providerRefund.id,
      },
    }).catch(() => undefined);

    throw new RefundServiceError(
      "Provider refund response did not match the request. Reconciliation is required.",
      "RECONCILIATION_PENDING",
      502,
    );
  }

  try {
    const updated = await db.refund.update({
      where: { id: refund.id },
      data: {
        providerRefundId: providerRefund.id,
      },
    });

    return {
      replayed: false,
      refundId: updated.id,
      status: updated.status,
      providerRefundId: updated.providerRefundId,
      amountMinor: updated.amountMinor.toString(),
      currency: updated.currency,
    };
  } catch {
    return {
      replayed: false,
      refundId: refund.id,
      status: "PENDING" as const,
      providerRefundId: providerRefund.id,
      amountMinor: refund.amountMinor.toString(),
      currency: refund.currency,
      reconciliationPending: true,
    };
  }
}
