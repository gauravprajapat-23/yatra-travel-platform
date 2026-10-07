import { getDb } from "@yatra/db/client";
import { createRazorpayRefund } from "@yatra/providers/payments/razorpay-client";

export class RefundServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "REFUNDS_DISABLED"
      | "PAYMENT_INTENT_NOT_FOUND"
      | "PAYMENT_NOT_REFUNDABLE"
      | "INVALID_REFUND_AMOUNT"
      | "IDEMPOTENCY_CONFLICT"
      | "PROVIDER_ERROR"
      | "RECONCILIATION_PENDING",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "RefundServiceError";
  }
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

    return {
      replayed: true,
      refundId: existing.id,
      status: existing.status,
      providerRefundId: existing.providerRefundId,
      amountMinor: existing.amountMinor.toString(),
      currency: existing.currency,
    };
  }

  const paymentIntent = await db.paymentIntent.findUnique({
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

  const reserved = await db.refund.aggregate({
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

  const refund = await db.refund.create({
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

  let providerRefund;

  try {
    providerRefund = await createRazorpayRefund({
      paymentId: paymentIntent.providerPaymentId,
      amountMinor: refund.amountMinor,
      notes: {
        refundId: refund.id,
        paymentIntentId: paymentIntent.id,
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
    providerRefund.payment_id !== paymentIntent.providerPaymentId ||
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
    throw new RefundServiceError(
      "Refund was accepted by Razorpay but local reconciliation is still pending.",
      "RECONCILIATION_PENDING",
      503,
    );
  }}
