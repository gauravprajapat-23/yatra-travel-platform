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
  createCustomerBookingRequestFingerprint,
} from "@yatra/domain/booking/idempotency";
import {
  assertQuoteUsable,
  createPriceSnapshot,
} from "@yatra/domain/booking/quote-policy";

export type CreateGuestPackageBookingInput = {
  quoteId: string;
  idempotencyKey: string;
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
    }
);

export class PackageBookingServiceError extends Error {
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
    this.name = "PackageBookingServiceError";
  }
}

function asInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function createPackageBookingReference(): string {
  return `YPK-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function toPackageBookingDto(booking: {
  reference: string;
  status: string;
  travellers: number;
  vehicleCount: number | null;
  travelStartAt: Date;
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
    travellers: booking.travellers,
    vehicleCount: booking.vehicleCount,
    travelStartAt: booking.travelStartAt.toISOString(),
    currency: booking.currency,
    subtotalMinor: booking.subtotalMinor.toString(),
    discountMinor: booking.discountMinor.toString(),
    taxMinor: booking.taxMinor.toString(),
    totalMinor: booking.totalMinor.toString(),
    createdAt: booking.createdAt.toISOString(),
  };
}

export async function createGuestPackageBooking(
  input: CreateGuestPackageBookingInput,
) {
  const customerUserId = input.customerUserId ?? null;
  const guestName = customerUserId ? null : input.guestName ?? null;
  const guestEmail = customerUserId ? null : input.guestEmail ?? null;

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
      })
    : createBookingRequestFingerprint({
        quoteId: input.quoteId,
        guestName: guestName!,
        guestEmail: guestEmail!,
      });

  const db = getDb();

  const existing = await db.packageBooking.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  if (existing) {
    try {
      assertIdempotentReplay(existing.requestFingerprint, fingerprint);
    } catch {
      throw new PackageBookingServiceError(
        "This idempotency key was already used for a different package booking request.",
        "IDEMPOTENCY_CONFLICT",
        409,
      );
    }

    return {
      replayed: true,
      booking: toPackageBookingDto(existing),
    };
  }

  try {
    return await db.$transaction(
      async (tx) => {
        const replay = await tx.packageBooking.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (replay) {
          try {
            assertIdempotentReplay(replay.requestFingerprint, fingerprint);
          } catch {
            throw new PackageBookingServiceError(
              "This idempotency key was already used for a different package booking request.",
              "IDEMPOTENCY_CONFLICT",
              409,
            );
          }

          return {
            replayed: true,
            booking: toPackageBookingDto(replay),
          };
        }

        const now = new Date();

        const quote = await tx.packageQuote.findUnique({
          where: { id: input.quoteId },
          include: {
            booking: true,
            priceOption: true,
            package: {
              include: {
                itinerary: {
                  orderBy: { dayNumber: "asc" },
                },
                destinations: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    destination: {
                      select: {
                        id: true,
                        slug: true,
                        name: true,
                        kind: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!quote) {
          throw new PackageBookingServiceError(
            "The requested package quote does not exist.",
            "QUOTE_NOT_FOUND",
            404,
          );
        }

        if (quote.booking) {
          throw new PackageBookingServiceError(
            "This package quote has already been used for a booking.",
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
          throw new PackageBookingServiceError(
            "This package quote has expired. Request a new quote before booking.",
            "QUOTE_EXPIRED",
            409,
          );
        }

        const policyRows = await tx.bookingPolicyVersion.findMany({
          where: {
            code: "PACKAGE_BOOKING",
            status: "ACTIVE",
          },
        });

        const policy = selectActiveBookingPolicy(
          policyRows.map((row) => ({
            ...row,
            document: row.document,
          })),
          "PACKAGE_BOOKING",
          now,
        );

        if (!policy) {
          throw new PackageBookingServiceError(
            "Package booking is temporarily unavailable because no active package-booking policy is configured.",
            "POLICY_UNAVAILABLE",
            503,
          );
        }

        const packageSnapshot = {
          packageId: quote.package.id,
          slug: quote.package.slug,
          title: quote.package.title,
          summary: quote.package.summary,
          durationDays: quote.package.durationDays,
          durationNights: quote.package.durationNights,
          itinerary: quote.package.itinerary,
          destinations: quote.package.destinations.map((item) => item.destination),
        };

        const priceSnapshot = {
          ...createPriceSnapshot({
            subtotalMinor: quote.subtotalMinor,
            discountMinor: quote.discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor: quote.totalMinor,
            currency: quote.currency,
          }),
          quoteId: quote.id,
          priceOptionId: quote.priceOptionId,
          priceMode: quote.priceOption.mode,
          quantity: quote.quantity,
          breakdown: quote.priceBreakdown,
        };

        const policySnapshot = createPolicySnapshot(policy);

        const booking = await tx.packageBooking.create({
          data: {
            reference: createPackageBookingReference(),
            quoteId: quote.id,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            status: "PENDING_REVIEW",
            packageId: quote.packageId,
            priceOptionId: quote.priceOptionId,
            travellers: quote.travellers,
            vehicleCount: quote.vehicleCount,
            travelStartAt: quote.travelStartAt,
            customerUserId,
            guestName: customerUserId ? null : guestName!.trim(),
            guestEmail: customerUserId
              ? null
              : guestEmail!.trim().toLowerCase(),
            currency: quote.currency,
            subtotalMinor: quote.subtotalMinor,
            discountMinor: quote.discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor: quote.totalMinor,
            packageSnapshot: asInputJson(packageSnapshot),
            priceSnapshot: asInputJson(priceSnapshot),
            policySnapshot: asInputJson(policySnapshot),
            bookingPolicyVersionId: policy.id,
            statusHistory: {
              create: {
                fromStatus: null,
                toStatus: "PENDING_REVIEW",
                reason: "Package booking created from server quote.",
              },
            },
          },
        });

        return {
          replayed: false,
          booking: toPackageBookingDto(booking),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof PackageBookingServiceError) {
      throw error;
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const replay = await db.packageBooking.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (replay) {
        if (replay.requestFingerprint !== fingerprint) {
          throw new PackageBookingServiceError(
            "This idempotency key was already used for a different package booking request.",
            "IDEMPOTENCY_CONFLICT",
            409,
          );
        }

        return {
          replayed: true,
          booking: toPackageBookingDto(replay),
        };
      }

      throw new PackageBookingServiceError(
        "The package booking conflicts with an existing quote or booking.",
        "BOOKING_CONFLICT",
        409,
      );
    }

    throw error;
  }
}
