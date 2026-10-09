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
import {
  createPromotionRedemption,
  preparePromotionForBooking,
  PromotionRedemptionError,
} from "@/modules/promotions/promotion-redemption-service";
import {
  PackageDepartureInventoryError,
  reservePackageDepartureInventory,
} from "@/modules/packages/package-departure-inventory-service";

export type CreateGuestPackageBookingInput = {
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
      | "BOOKING_CONFLICT"
      | "PROMOTION_DISABLED"
      | "PROMOTION_INVALID"
      | "PROMOTION_UNAVAILABLE"
      | "DEPARTURE_UNAVAILABLE",
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
        promotionCode,
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
            departure: true,
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

        let departureReservation:
          | Awaited<ReturnType<typeof reservePackageDepartureInventory>>
          | null = null;

        if (quote.departureId) {
          try {
            departureReservation = await reservePackageDepartureInventory(tx, {
              departureId: quote.departureId,
              packageId: quote.packageId,
              travellers: quote.travellers,
              at: now,
            });
          } catch (error) {
            if (error instanceof PackageDepartureInventoryError) {
              throw new PackageBookingServiceError(
                error.message,
                "DEPARTURE_UNAVAILABLE",
                409,
              );
            }
            throw error;
          }
        }

        let promotion:
          | Awaited<ReturnType<typeof preparePromotionForBooking>>
          | null = null;
        let discountMinor = quote.discountMinor;
        let totalMinor = quote.totalMinor;

        if (promotionCode) {
          if (process.env.PROMOTION_APPLY_ENABLED !== "true") {
            throw new PackageBookingServiceError(
              "Promotion application is not enabled yet.",
              "PROMOTION_DISABLED",
              503,
            );
          }

          if (quote.discountMinor !== 0n) {
            throw new PackageBookingServiceError(
              "Promotion codes cannot be combined with another quote discount.",
              "PROMOTION_UNAVAILABLE",
              409,
            );
          }

          try {
            promotion = await preparePromotionForBooking(tx, {
              code: promotionCode,
              bookingType: "PACKAGE",
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
              throw new PackageBookingServiceError(
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
          priceOptionId: quote.priceOptionId,
          priceMode: quote.priceOption.mode,
          quantity: quote.quantity,
          breakdown: quote.priceBreakdown,
          departure: departureReservation?.snapshot ?? quote.departureSnapshot ?? null,
          promotion: promotion?.snapshot ?? null,
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
            travelStartAt: departureReservation
              ? departureReservation.departure.startsAt
              : quote.travelStartAt,
            departureId: departureReservation?.departure.id ?? null,
            departureSnapshot: departureReservation
              ? asInputJson(departureReservation.snapshot)
              : quote.departureSnapshot ?? Prisma.JsonNull,
            customerUserId,
            guestName: customerUserId ? null : guestName!.trim(),
            guestEmail: customerUserId
              ? null
              : guestEmail!.trim().toLowerCase(),
            promotionId: promotion?.promotionId ?? null,
            promotionSnapshot: promotion
              ? asInputJson(promotion.snapshot)
              : Prisma.JsonNull,
            currency: quote.currency,
            subtotalMinor: quote.subtotalMinor,
            discountMinor,
            taxMinor: quote.taxMinor,
            totalMinor,
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

        if (promotion) {
          try {
            await createPromotionRedemption(tx, {
              promotionId: promotion.promotionId,
              currency: quote.currency,
              discountMinor: promotion.discountMinor,
              identity: customerUserId
                ? { customerUserId }
                : { guestEmailNormalized: guestEmail!.trim().toLowerCase() },
              booking: { packageBookingId: booking.id },
              at: now,
            });
          } catch (error) {
            if (error instanceof PromotionRedemptionError) {
              throw new PackageBookingServiceError(
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
