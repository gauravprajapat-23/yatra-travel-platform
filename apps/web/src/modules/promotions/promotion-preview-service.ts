import { getDb } from "@yatra/db/client";
import {
  assertQuoteUsable,
} from "@yatra/domain/booking/quote-policy";
import {
  calculatePromotionDiscount,
  type PromotionRule,
} from "@yatra/domain/promotions/discount";
import {
  normalizePromotionCode,
  promotionSnapshot,
} from "./promotion-management-service";

type PromotionIdentity =
  | { customerUserId: string; guestEmail?: never }
  | { customerUserId?: never; guestEmail: string };

export class PromotionPreviewError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "QUOTE_NOT_FOUND"
      | "QUOTE_EXPIRED"
      | "PROMOTION_NOT_FOUND"
      | "PROMOTION_UNAVAILABLE"
      | "PROMOTION_NOT_ELIGIBLE",
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "PromotionPreviewError";
  }
}

function normalizeGuestEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new PromotionPreviewError(
      "A valid email is required to validate this promotion.",
      "PROMOTION_NOT_ELIGIBLE",
      400,
    );
  }
  return email;
}

export async function previewPromotionForQuote(input: {
  quoteType: "CAR" | "PACKAGE";
  quoteId: string;
  code: string;
  identity: PromotionIdentity;
  at?: Date;
}) {
  const db = getDb();
  const now = input.at ?? new Date();
  const code = normalizePromotionCode(input.code);

  const quote =
    input.quoteType === "CAR"
      ? await db.carQuote.findUnique({
          where: { id: input.quoteId },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            currency: true,
            subtotalMinor: true,
            taxMinor: true,
          },
        })
      : await db.packageQuote.findUnique({
          where: { id: input.quoteId },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            currency: true,
            subtotalMinor: true,
            taxMinor: true,
          },
        });

  if (!quote) {
    throw new PromotionPreviewError(
      "The requested quote does not exist.",
      "QUOTE_NOT_FOUND",
      404,
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
    throw new PromotionPreviewError(
      "This quote has expired. Request a new quote before applying a promotion.",
      "QUOTE_EXPIRED",
      409,
    );
  }

  const promotion = await db.promotion.findUnique({
    where: { code },
  });

  if (!promotion) {
    throw new PromotionPreviewError(
      "Promotion code is invalid.",
      "PROMOTION_NOT_FOUND",
      404,
    );
  }

  if (promotion.status !== "ACTIVE") {
    throw new PromotionPreviewError(
      "Promotion is not currently available.",
      "PROMOTION_UNAVAILABLE",
      409,
    );
  }

  const customerUserId =
    typeof input.identity.customerUserId === "string"
      ? input.identity.customerUserId
      : null;
  const guestEmailNormalized =
    typeof input.identity.guestEmail === "string"
      ? normalizeGuestEmail(input.identity.guestEmail)
      : null;

  const customerRedemptionCount =
    promotion.perCustomerLimit === null
      ? 0
      : await db.promotionRedemption.count({
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
      bookingType: input.quoteType,
      subtotalMinor: quote.subtotalMinor,
      currency: quote.currency,
      at: now,
      customerRedemptionCount,
    });
  } catch (error) {
    throw new PromotionPreviewError(
      error instanceof Error
        ? error.message
        : "Promotion is not eligible for this quote.",
      "PROMOTION_NOT_ELIGIBLE",
      409,
    );
  }

  const totalMinor =
    calculated.payableBeforeTaxMinor + quote.taxMinor;

  return {
    quoteId: quote.id,
    promotionId: promotion.id,
    code: promotion.code,
    name: promotion.name,
    currency: quote.currency,
    subtotalMinor: quote.subtotalMinor,
    discountMinor: calculated.discountMinor,
    taxMinor: quote.taxMinor,
    totalMinor,
    promotionSnapshot: promotionSnapshot({
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
