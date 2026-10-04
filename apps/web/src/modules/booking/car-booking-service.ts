import { randomUUID } from "node:crypto";
import { getDb, Prisma } from "@yatra/db/client";
import {
  createPolicySnapshot,
  selectActiveBookingPolicy,
} from "@yatra/domain/booking/booking-policy";
import { assertBookingCustomerIdentity } from "@yatra/domain/booking/customer-identity";
import {
  assertIdempotentReplay,
  createBookingRequestFingerprint,
} from "@yatra/domain/booking/idempotency";
import {
  assertQuoteUsable,
  createPriceSnapshot,
} from "@yatra/domain/booking/quote-policy";

export type CreateGuestCarBookingInput = {
  quoteId: string;
  idempotencyKey: string;
  guestName: string;
  guestEmail: string;
};

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "QUOTE_NOT_FOUND"
      | "QUOTE_EXPIRED"
      | "QUOTE_ALREADY_USED"
      | "POLICY_UNAVAILABLE"
      | "IDEMPOTENCY_CONFLICT"
      | "BOOKING_CONFLICT",
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
  assertBookingCustomerIdentity({
    guestName: input.guestName,
    guestEmail: input.guestEmail,
  });

  const fingerprint = createBookingRequestFingerprint({
    quoteId: input.quoteId,
    guestName: input.guestName,
    guestEmail: input.guestEmail,
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

        const priceSnapshot = {
          ...createPriceSnapshot({
            subtotalMinor: quote.subtotalMinor,
            discountMinor: quote.discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor: quote.totalMinor,
            currency: quote.currency,
          }),
          quoteId: quote.id,
          pricingRuleId: quote.pricingRuleId,
          breakdown: quote.priceBreakdown,
        };

        const policySnapshot = createPolicySnapshot(policy);

        const booking = await tx.carBooking.create({
          data: {
            reference: createBookingReference(),
            quoteId: quote.id,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            status: "PENDING_REVIEW",
            tripType: quote.tripType,
            originText: quote.originText,
            destinationText: quote.destinationText,
            startsAt: quote.startsAt,
            endsAt: quote.endsAt,
            travellers: quote.travellers,
            guestName: input.guestName.trim(),
            guestEmail: input.guestEmail.trim().toLowerCase(),
            vehicleClassId: quote.vehicleClassId,
            pricingRuleId: quote.pricingRuleId,
            currency: quote.currency,
            subtotalMinor: quote.subtotalMinor,
            discountMinor: quote.discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor: quote.totalMinor,
            priceSnapshot: asInputJson(priceSnapshot),
            policySnapshot: asInputJson(policySnapshot),
            bookingPolicyVersionId: policy.id,
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: "PENDING_REVIEW",
                reason: "Booking created from server quote.",
              },
            },
          },
        });

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
