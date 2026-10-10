import { randomUUID } from "node:crypto";
import { getDb, Prisma } from "@yatra/db/client";
import { encryptSensitiveString } from "@yatra/providers/security/field-encryption";
import {
  createPolicySnapshot,
  selectActiveBookingPolicy,
} from "@yatra/domain/booking/booking-policy";
import { assertBookingCustomerIdentity } from "@yatra/domain/booking/customer-identity";
import {
  assertIdempotentReplay,
  createBookingRequestFingerprint,
  createCustomerBookingRequestFingerprint,
} from "@yatra/domain/booking/idempotency";
import {
  assertQuoteUsable,
  createPriceSnapshot,
} from "@yatra/domain/booking/quote-policy";
import {
  createPromotionRedemption,
  preparePromotionForBooking,
  PromotionRedemptionError,
} from "@/modules/promotions/promotion-redemption-service";

export type CreateGuestCarBookingInput = {
  quoteId: string;
  idempotencyKey: string;
  promotionCode?: string | null;
} & (
  | {
      customerUserId: string;
      guestName?: never;
      guestEmail?: never;
    }
  | {
      customerUserId?: null;
      guestName: string;
      guestEmail: string;
      guestPhone?: string | null;
    }
);

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "QUOTE_NOT_FOUND"
      | "QUOTE_EXPIRED"
      | "QUOTE_ALREADY_USED"
      | "POLICY_UNAVAILABLE"
      | "IDEMPOTENCY_CONFLICT"
      | "BOOKING_CONFLICT"
      | "PROMOTION_DISABLED"
      | "PROMOTION_INVALID"
      | "PROMOTION_UNAVAILABLE",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "BookingServiceError";
  }
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function createBookingReference(): string {
  return `YAT-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function toBookingDto(booking: {
  reference: string;
  status: string;
  originText: string;
  destinationText: string;
  startsAt: Date;
  endsAt: Date | null;
  travellers: number;
  currency: string;
  subtotalMinor: bigint;
  discountMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  createdAt: Date;
}) {
  return {
    reference: booking.reference,
    status: booking.status,
    originText: booking.originText,
    destinationText: booking.destinationText,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt?.toISOString() ?? null,
    travellers: booking.travellers,
    currency: booking.currency,
    subtotalMinor: booking.subtotalMinor.toString(),
    discountMinor: booking.discountMinor.toString(),
    taxMinor: booking.taxMinor.toString(),
    totalMinor: booking.totalMinor.toString(),
    createdAt: booking.createdAt.toISOString(),
  };
}

export async function createGuestCarBooking(
  input: CreateGuestCarBookingInput,
) {
  const customerUserId = input.customerUserId ?? null;
  const guestName = customerUserId ? null : input.guestName ?? null;
  const guestEmail = customerUserId ? null : input.guestEmail ?? null;
  const guestPhone = customerUserId ? null : input.guestPhone?.trim() || null;
  const promotionCode = input.promotionCode?.trim() || null;

  if (!customerUserId && (!guestName || !guestEmail)) {
    throw new Error("Guest booking requires name and email.");
  }

  assertBookingCustomerIdentity(
    customerUserId
      ? { customerUserId }
      : {
          guestName: guestName!,
          guestEmail: guestEmail!,
        },
  );

  const fingerprint = customerUserId
    ? createCustomerBookingRequestFingerprint({
        quoteId: input.quoteId,
        customerUserId,
        promotionCode,
      })
    : createBookingRequestFingerprint({
        quoteId: input.quoteId,
        guestName: guestName!,
        guestEmail: guestEmail!,
        guestPhone,
        promotionCode,
      });

  const db = getDb();

  const existing = await db.carBooking.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    try {
      assertIdempotentReplay(existing.requestFingerprint, fingerprint);
    } catch {
      throw new BookingServiceError(
        "This idempotency key was already used for a different booking request.",
        "IDEMPOTENCY_CONFLICT",
        409,
      );
    }

    return {
      replayed: true,
      booking: toBookingDto(existing),
    };
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const replay = await tx.carBooking.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (replay) {
          try {
            assertIdempotentReplay(replay.requestFingerprint, fingerprint);
          } catch {
            throw new BookingServiceError(
              "This idempotency key was already used for a different booking request.",
              "IDEMPOTENCY_CONFLICT",
              409,
            );
          }

          return {
            replayed: true,
            booking: toBookingDto(replay),
          };
        }

        const now = new Date();

        const quote = await tx.carQuote.findUnique({
          where: { id: input.quoteId },
          include: { booking: true },
        });

        if (!quote) {
          throw new BookingServiceError(
            "The requested quote does not exist.",
            "QUOTE_NOT_FOUND",
            404,
          );
        }

        if (quote.booking) {
          throw new BookingServiceError(
            "This quote has already been used for a booking.",
            "QUOTE_ALREADY_USED",
            409,
          );
        }

        try {
          assertQuoteUsable(
            {
              createdAt: quote.createdAt,
              expiresAt: quote.expiresAt,
            },
            now,
          );
        } catch {
          throw new BookingServiceError(
            "This quote has expired. Request a new quote before booking.",
            "QUOTE_EXPIRED",
            409,
          );
        }

        const policyRows = await tx.bookingPolicyVersion.findMany({
          where: {
            code: "CAR_BOOKING",
            status: "ACTIVE",
          },
        });

        const policy = selectActiveBookingPolicy(
          policyRows.map((row) => ({
            ...row,
            document: row.document,
          })),
          "CAR_BOOKING",
          now,
        );

        if (!policy) {
          throw new BookingServiceError(
            "Car booking is temporarily unavailable because no active booking policy is configured.",
            "POLICY_UNAVAILABLE",
            503,
          );
        }

        let promotion:
          | Awaited<ReturnType<typeof preparePromotionForBooking>>
          | null = null;
        let discountMinor = quote.discountMinor;
        let totalMinor = quote.totalMinor;

        if (promotionCode) {
          if (process.env.PROMOTION_APPLY_ENABLED !== "true") {
            throw new BookingServiceError(
              "Promotion application is not enabled yet.",
              "PROMOTION_DISABLED",
              503,
            );
          }

          if (quote.discountMinor !== 0n) {
            throw new BookingServiceError(
              "Promotion codes cannot be combined with another quote discount.",
              "PROMOTION_UNAVAILABLE",
              409,
            );
          }

          try {
            promotion = await preparePromotionForBooking(tx, {
              code: promotionCode,
              bookingType: "CAR",
              subtotalMinor: quote.subtotalMinor,
              taxMinor: quote.taxMinor,
              currency: quote.currency,
              identity: customerUserId
                ? { customerUserId }
                : { guestEmailNormalized: guestEmail!.trim().toLowerCase() },
              at: now,
            });
          } catch (error) {
            if (error instanceof PromotionRedemptionError) {
              throw new BookingServiceError(
                error.message,
                error.code === "PROMOTION_NOT_FOUND"
                  ? "PROMOTION_INVALID"
                  : "PROMOTION_UNAVAILABLE",
                error.code === "PROMOTION_NOT_FOUND" ? 404 : 409,
              );
            }
            throw error;
          }

          discountMinor = promotion.discountMinor;
          totalMinor = promotion.totalMinor;
        }

        const priceSnapshot = {
          ...createPriceSnapshot({
            subtotalMinor: quote.subtotalMinor,
            discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor,
            currency: quote.currency,
          }),
          quoteId: quote.id,
          pricingRuleId: quote.pricingRuleId,
          breakdown: quote.priceBreakdown,
          promotion: promotion?.snapshot ?? null,
        };

        const policySnapshot = createPolicySnapshot(policy);

        const initialStatus =
          process.env.PAYMENT_WRITE_ENABLED === "true" && totalMinor > 0n
            ? "PENDING_PAYMENT"
            : "PENDING_REVIEW";

        const reference = createBookingReference();
        const guestPhoneCiphertext = guestPhone
          ? encryptSensitiveString(guestPhone, `car-booking:${reference}:guest-phone`)
          : null;

        const booking = await tx.carBooking.create({
          data: {
            reference,
            quoteId: quote.id,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            status: initialStatus,
            tripType: quote.tripType,
            originText: quote.originText,
            destinationText: quote.destinationText,
            startsAt: quote.startsAt,
            endsAt: quote.endsAt,
            travellers: quote.travellers,
            customerUserId,
            guestName: customerUserId ? null : guestName!.trim(),
            guestEmail: customerUserId
              ? null
              : guestEmail!.trim().toLowerCase(),
            guestPhoneCiphertext,
            vehicleClassId: quote.vehicleClassId,
            pricingRuleId: quote.pricingRuleId,
            promotionId: promotion?.promotionId ?? null,
            promotionSnapshot: promotion
              ? asInputJson(promotion.snapshot)
              : Prisma.JsonNull,
            currency: quote.currency,
            subtotalMinor: quote.subtotalMinor,
            discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor,
            priceSnapshot: asInputJson(priceSnapshot),
            policySnapshot: asInputJson(policySnapshot),
            bookingPolicyVersionId: policy.id,
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: initialStatus,
                reason:
                  initialStatus === "PENDING_PAYMENT"
                    ? "Booking created from server quote and is ready for payment."
                    : "Booking created from server quote and is pending review.",
              },
            },
          },
        });

        if (promotion) {
          try {
            await createPromotionRedemption(tx, {
              promotionId: promotion.promotionId,
              currency: quote.currency,
              discountMinor: promotion.discountMinor,
              identity: customerUserId
                ? { customerUserId }
                : { guestEmailNormalized: guestEmail!.trim().toLowerCase() },
              booking: { carBookingId: booking.id },
              at: now,
            });
          } catch (error) {
            if (error instanceof PromotionRedemptionError) {
              throw new BookingServiceError(
                error.message,
                error.code === "PROMOTION_NOT_FOUND"
                  ? "PROMOTION_INVALID"
                  : "PROMOTION_UNAVAILABLE",
                error.code === "PROMOTION_NOT_FOUND" ? 404 : 409,
              );
            }
            throw error;
          }
        }

        return {
          replayed: false,
          booking: toBookingDto(booking),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof BookingServiceError) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const replay = await db.carBooking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (replay) {
        if (replay.requestFingerprint !== fingerprint) {
          throw new BookingServiceError(
            "This idempotency key was already used for a different booking request.",
            "IDEMPOTENCY_CONFLICT",
            409,
          );
        }

        return {
          replayed: true,
          booking: toBookingDto(replay),
        };
      }

      throw new BookingServiceError(
        "The booking conflicts with an existing quote or booking.",
        "BOOKING_CONFLICT",
        409,
      );
    }

    throw error;
  }
}
