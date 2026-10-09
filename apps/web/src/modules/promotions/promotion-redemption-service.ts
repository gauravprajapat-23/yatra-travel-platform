import { Prisma } from "@yatra/db/client";
import {
  calculatePromotionDiscount,
  type PromotionRule,
} from "@yatra/domain/promotions/discount";
import {
  normalizePromotionCode,
  promotionSnapshot,
} from "./promotion-management-service";

type PromotionRedemptionIdentity =
  | { customerUserId: string; guestEmailNormalized?: never }
  | { customerUserId?: never; guestEmailNormalized: string };

type BookingLink =
  | { carBookingId: string; packageBookingId?: never }
  | { carBookingId?: never; packageBookingId: string };

export class PromotionRedemptionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "PROMOTION_NOT_FOUND"
      | "PROMOTION_NOT_ACTIVE"
      | "PROMOTION_EXHAUSTED"
      | "CUSTOMER_LIMIT_REACHED"
      | "PROMOTION_REDEMPTION_CONFLICT",
  ) {
    super(message);
    this.name = "PromotionRedemptionError";
  }
}

function normalizeGuestEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid guest email is required for promotion redemption.");
  }
  return email;
}

export async function preparePromotionForBooking(
  tx: Prisma.TransactionClient,
  input: {
    code: string;
    bookingType: "CAR" | "PACKAGE";
    subtotalMinor: bigint;
    taxMinor: bigint;
    currency: string;
    identity: PromotionRedemptionIdentity;
    at?: Date;
  },
) {
  const now = input.at ?? new Date();
  const code = normalizePromotionCode(input.code);

  const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Promotion"
    WHERE "code" = ${code}
    FOR UPDATE
  `;

  const promotionId = lockedRows[0]?.id;
  if (!promotionId) {
    throw new PromotionRedemptionError(
      "Promotion code is invalid.",
      "PROMOTION_NOT_FOUND",
    );
  }

  const promotion = await tx.promotion.findUnique({
    where: { id: promotionId },
  });

  if (!promotion) {
    throw new PromotionRedemptionError(
      "Promotion code is invalid.",
      "PROMOTION_NOT_FOUND",
    );
  }

  if (promotion.status !== "ACTIVE") {
    throw new PromotionRedemptionError(
      "Promotion is no longer active.",
      "PROMOTION_NOT_ACTIVE",
    );
  }

  const customerUserId =
    typeof input.identity.customerUserId === "string"
      ? input.identity.customerUserId
      : null;
  const guestEmailNormalized =
    typeof input.identity.guestEmailNormalized === "string"
      ? normalizeGuestEmail(input.identity.guestEmailNormalized)
      : null;

  const customerRedemptionCount =
    promotion.perCustomerLimit === null
      ? 0
      : await tx.promotionRedemption.count({
          where: {
            promotionId: promotion.id,
            ...(customerUserId
              ? { customerUserId }
              : { guestEmailNormalized }),
          },
        });

  const rule: PromotionRule = {
    scope: promotion.scope,
    discountKind: promotion.discountKind,
    percentageBps: promotion.percentageBps,
    fixedAmountMinor: promotion.fixedAmountMinor,
    currency: promotion.currency,
    minSubtotalMinor: promotion.minSubtotalMinor,
    maxDiscountMinor: promotion.maxDiscountMinor,
    activeFrom: promotion.activeFrom,
    activeTo: promotion.activeTo,
    maxRedemptions: promotion.maxRedemptions,
    redeemedCount: promotion.redeemedCount,
    perCustomerLimit: promotion.perCustomerLimit,
  };

  let calculated;
  try {
    calculated = calculatePromotionDiscount(rule, {
      bookingType: input.bookingType,
      subtotalMinor: input.subtotalMinor,
      currency: input.currency,
      at: now,
      customerRedemptionCount,
    });
  } catch (error) {
    throw new PromotionRedemptionError(
      error instanceof Error
        ? error.message
        : "Promotion is not eligible for this booking.",
      promotion.maxRedemptions !== null &&
        promotion.redeemedCount >= promotion.maxRedemptions
        ? "PROMOTION_EXHAUSTED"
        : promotion.perCustomerLimit !== null &&
            customerRedemptionCount >= promotion.perCustomerLimit
          ? "CUSTOMER_LIMIT_REACHED"
          : "PROMOTION_NOT_ACTIVE",
    );
  }

  return {
    promotionId: promotion.id,
    code: promotion.code,
    discountMinor: calculated.discountMinor,
    totalMinor: calculated.payableBeforeTaxMinor + input.taxMinor,
    snapshot: promotionSnapshot({
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      scope: promotion.scope,
      discountKind: promotion.discountKind,
      percentageBps: promotion.percentageBps,
      fixedAmountMinor: promotion.fixedAmountMinor,
      currency: promotion.currency,
      minSubtotalMinor: promotion.minSubtotalMinor,
      maxDiscountMinor: promotion.maxDiscountMinor,
      maxRedemptions: promotion.maxRedemptions,
      perCustomerLimit: promotion.perCustomerLimit,
      activeFrom: promotion.activeFrom,
      activeTo: promotion.activeTo,
    }),
  };
}

export async function createPromotionRedemption(
  tx: Prisma.TransactionClient,
  input: {
    promotionId: string;
    currency: string;
    discountMinor: bigint;
    identity: PromotionRedemptionIdentity;
    booking: BookingLink;
    at?: Date;
  },
) {
  if (input.discountMinor <= 0n) {
    throw new Error("Promotion redemption discount must be positive.");
  }

  const now = input.at ?? new Date();

  await tx.$queryRaw`
    SELECT "id"
    FROM "Promotion"
    WHERE "id" = ${input.promotionId}
    FOR UPDATE
  `;

  const promotion = await tx.promotion.findUnique({
    where: { id: input.promotionId },
    select: {
      id: true,
      status: true,
      maxRedemptions: true,
      redeemedCount: true,
      perCustomerLimit: true,
      activeFrom: true,
      activeTo: true,
    },
  });

  if (!promotion) {
    throw new PromotionRedemptionError("Promotion no longer exists.", "PROMOTION_NOT_FOUND");
  }

  if (
    promotion.status !== "ACTIVE" ||
    (promotion.activeFrom && now < promotion.activeFrom) ||
    (promotion.activeTo && now >= promotion.activeTo)
  ) {
    throw new PromotionRedemptionError("Promotion is no longer active.", "PROMOTION_NOT_ACTIVE");
  }

  if (
    promotion.maxRedemptions !== null &&
    promotion.redeemedCount >= promotion.maxRedemptions
  ) {
    throw new PromotionRedemptionError(
      "Promotion redemption limit has been reached.",
      "PROMOTION_EXHAUSTED",
    );
  }

  const customerUserId =
    typeof input.identity.customerUserId === "string"
      ? input.identity.customerUserId
      : null;
  const guestEmailNormalized =
    typeof input.identity.guestEmailNormalized === "string"
      ? normalizeGuestEmail(input.identity.guestEmailNormalized)
      : null;

  if (promotion.perCustomerLimit !== null) {
    const customerCount = await tx.promotionRedemption.count({
      where: {
        promotionId: promotion.id,
        ...(customerUserId ? { customerUserId } : { guestEmailNormalized }),
      },
    });

    if (customerCount >= promotion.perCustomerLimit) {
      throw new PromotionRedemptionError(
        "Promotion per-customer redemption limit has been reached.",
        "CUSTOMER_LIMIT_REACHED",
      );
    }
  }

  try {
    const redemption = await tx.promotionRedemption.create({
      data: {
        promotionId: promotion.id,
        customerUserId,
        guestEmailNormalized,
        carBookingId:
          typeof input.booking.carBookingId === "string"
            ? input.booking.carBookingId
            : null,
        packageBookingId:
          typeof input.booking.packageBookingId === "string"
            ? input.booking.packageBookingId
            : null,
        currency: input.currency,
        discountMinor: input.discountMinor,
        redeemedAt: now,
      },
    });

    const updated = await tx.promotion.updateMany({
      where: {
        id: promotion.id,
        ...(promotion.maxRedemptions !== null
          ? { redeemedCount: { lt: promotion.maxRedemptions } }
          : { redeemedCount: promotion.redeemedCount }),
      },
      data: { redeemedCount: { increment: 1 } },
    });

    if (updated.count !== 1) {
      throw new PromotionRedemptionError(
        "Promotion redemption limit changed while booking.",
        "PROMOTION_EXHAUSTED",
      );
    }

    return redemption;
  } catch (error) {
    if (error instanceof PromotionRedemptionError) throw error;

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new PromotionRedemptionError(
        "This booking already has a promotion redemption.",
        "PROMOTION_REDEMPTION_CONFLICT",
      );
    }

    throw error;
  }
}
