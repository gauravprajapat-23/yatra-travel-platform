import { getDb, Prisma } from "@yatra/db/client";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function nestedEntity(
  payload: unknown,
  key: "payment" | "order" | "refund",
): JsonObject | null {
  const root = asObject(payload);
  const payloadObject = asObject(root?.payload);
  const wrapper = asObject(payloadObject?.[key]);
  return asObject(wrapper?.entity);
}

function stringField(object: JsonObject | null, field: string): string | null {
  const value = object?.[field];
  return typeof value === "string" ? value : null;
}

function numberField(object: JsonObject | null, field: string): number | null {
  const value = object?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanField(object: JsonObject | null, field: string): boolean | null {
  const value = object?.[field];
  return typeof value === "boolean" ? value : null;
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
              reason: "Payment captured from verified Razorpay webhook.",
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
              reason: "Payment captured from verified Razorpay webhook.",
            },
          },
        },
      });
    }
  }
}

async function markBookingRefunded(
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

    if (booking?.status === "REFUND_PENDING") {
      await tx.carBooking.update({
        where: { id: booking.id },
        data: {
          status: "REFUNDED",
          statusHistory: {
            create: {
              fromStatus: "REFUND_PENDING",
              toStatus: "REFUNDED",
              reason: "Full refund processed from verified Razorpay webhook.",
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

    if (booking?.status === "REFUND_PENDING") {
      await tx.packageBooking.update({
        where: { id: booking.id },
        data: {
          status: "REFUNDED",
          statusHistory: {
            create: {
              fromStatus: "REFUND_PENDING",
              toStatus: "REFUNDED",
              reason: "Full refund processed from verified Razorpay webhook.",
            },
          },
        },
      });
    }
  }
}

async function processPaymentEvent(
  eventType: string,
  payload: unknown,
): Promise<string | null> {
  const entity = nestedEntity(payload, "payment");

  if (!entity) {
    return "payment entity missing";
  }

  const paymentId = stringField(entity, "id");
  const orderId = stringField(entity, "order_id");
  const currency = stringField(entity, "currency");
  const amount = numberField(entity, "amount");
  const captured = booleanField(entity, "captured");

  if (!paymentId || !orderId || !currency || amount === null) {
    return "payment entity missing required fields";
  }

  const db = getDb();

  const intent = await db.paymentIntent.findUnique({
    where: { providerOrderId: orderId },
  });

  if (!intent) {
    return "no matching payment intent";
  }

  if (
    intent.currency !== currency ||
    intent.amountMinor !== BigInt(amount)
  ) {
    return "provider payment did not match stored amount/currency";
  }

  await db.$transaction(
    async (tx) => {
      const freshIntent = await tx.paymentIntent.findUnique({
        where: { id: intent.id },
      });

      if (!freshIntent) {
        throw new Error("payment intent disappeared during webhook processing");
      }

      if (eventType === "payment.authorized") {
        if (
          freshIntent.status === "CAPTURED" ||
          freshIntent.status === "PARTIALLY_REFUNDED" ||
          freshIntent.status === "REFUNDED"
        ) {
          return;
        }

        await tx.paymentIntent.update({
          where: { id: freshIntent.id },
          data: {
            status: "AUTHORIZED",
            providerPaymentId: paymentId,
            authorizedAt: new Date(),
          },
        });
        return;
      }

      if (eventType === "payment.failed") {
        if (
          freshIntent.status === "CAPTURED" ||
          freshIntent.status === "PARTIALLY_REFUNDED" ||
          freshIntent.status === "REFUNDED"
        ) {
          return;
        }

        await tx.paymentIntent.update({
          where: { id: freshIntent.id },
          data: {
            status: "FAILED",
            providerPaymentId: paymentId,
            failedAt: new Date(),
          },
        });
        return;
      }

      if (eventType === "payment.captured") {
        if (captured !== true) {
          throw new Error("payment.captured event did not contain captured=true");
        }

        if (
          freshIntent.status === "CAPTURED" &&
          freshIntent.providerPaymentId === paymentId
        ) {
          return;
        }

        if (
          freshIntent.status === "CAPTURED" ||
          freshIntent.status === "PARTIALLY_REFUNDED" ||
          freshIntent.status === "REFUNDED"
        ) {
          throw new Error(
            "payment intent already captured by a different payment or moved beyond capture",
          );
        }

        const updated = await tx.paymentIntent.update({
          where: { id: freshIntent.id },
          data: {
            status: "CAPTURED",
            providerPaymentId: paymentId,
            amountPaidMinor: BigInt(amount),
            capturedAt: new Date(),
          },
        });

        await confirmBookingFromPayment(tx, updated);
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  return null;
}

async function processRefundEvent(
  eventType: string,
  payload: unknown,
): Promise<string | null> {
  const entity = nestedEntity(payload, "refund");

  if (!entity) {
    return "refund entity missing";
  }

  const refundId = stringField(entity, "id");
  const paymentId = stringField(entity, "payment_id");
  const currency = stringField(entity, "currency");
  const amount = numberField(entity, "amount");

  if (!refundId || !paymentId || !currency || amount === null) {
    return "refund entity missing required fields";
  }

  const db = getDb();

  const paymentIntent = await db.paymentIntent.findUnique({
    where: { providerPaymentId: paymentId },
  });

  if (!paymentIntent) {
    return "no matching payment intent for refund";
  }

  const notes = asObject(entity.notes);
  const localRefundId = stringField(notes, "refundId");
  const notedPaymentIntentId = stringField(notes, "paymentIntentId");

  const refundByProviderId = await db.refund.findUnique({
    where: { providerRefundId: refundId },
  });

  const refund =
    refundByProviderId ??
    (localRefundId
      ? await db.refund.findUnique({
          where: { id: localRefundId },
        })
      : null);

  if (!refund) {
    return "no matching refund record";
  }

  if (
    refund.paymentIntentId !== paymentIntent.id ||
    refund.currency !== currency ||
    refund.amountMinor !== BigInt(amount) ||
    (refund.providerRefundId && refund.providerRefundId !== refundId) ||
    (notedPaymentIntentId && notedPaymentIntentId !== paymentIntent.id)
  ) {
    return "refund event did not match stored refund";
  }

  if (eventType === "refund.processed") {
    await db.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          providerRefundId: refund.providerRefundId ?? refundId,
        },
      });

      const processed = await tx.refund.aggregate({
        where: {
          paymentIntentId: paymentIntent.id,
          status: "PROCESSED",
        },
        _sum: { amountMinor: true },
      });

      const refundedMinor = processed._sum.amountMinor ?? 0n;

      const fullyRefunded =
        refundedMinor >= paymentIntent.amountPaidMinor;

      await tx.paymentIntent.update({
        where: { id: paymentIntent.id },
        data: {
          status: fullyRefunded
            ? "REFUNDED"
            : "PARTIALLY_REFUNDED",
        },
      });

      if (fullyRefunded) {
        await markBookingRefunded(tx, paymentIntent);
      }
    });
  } else if (eventType === "refund.failed") {
    if (refund.status !== "PROCESSED") {
      await db.refund.update({
        where: { id: refund.id },
        data: {
          status: "FAILED",
          providerRefundId: refund.providerRefundId ?? refundId,
        },
      });
    }
  }

  return null;
}

export async function processRazorpayWebhookEvent(input: {
  webhookEventId: bigint;
  eventType: string;
  payload: unknown;
}): Promise<{ processed: boolean; error: string | null }> {
  const db = getDb();

  const event = await db.paymentWebhookEvent.findUnique({
    where: { id: input.webhookEventId },
  });

  if (!event) {
    return { processed: false, error: "webhook event not found" };
  }

  if (event.processedAt) {
    return { processed: true, error: null };
  }

  let processingError: string | null = null;

  try {
    if (
      input.eventType === "payment.authorized" ||
      input.eventType === "payment.captured" ||
      input.eventType === "payment.failed"
    ) {
      processingError = await processPaymentEvent(
        input.eventType,
        input.payload,
      );
    } else if (
      input.eventType === "refund.processed" ||
      input.eventType === "refund.failed"
    ) {
      processingError = await processRefundEvent(
        input.eventType,
        input.payload,
      );
    }
  } catch (error) {
    processingError =
      error instanceof Error ? error.message : "unknown processing error";
  }

  await db.paymentWebhookEvent.update({
    where: { id: input.webhookEventId },
    data: processingError
      ? {
          processedAt: null,
          processingError,
        }
      : {
          processedAt: new Date(),
          processingError: null,
        },
  });

  return {
    processed: processingError === null,
    error: processingError,
  };
}
