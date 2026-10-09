import { getDb } from "@yatra/db/client";
import {
  assertPromotionRule,
  promotionDiscountKinds,
  promotionScopes,
  type PromotionDiscountKind,
  type PromotionScope,
} from "@yatra/domain/promotions/discount";

export const promotionStatuses = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
] as const;

export type PromotionStatusValue = (typeof promotionStatuses)[number];

export function isPromotionStatus(value: string): value is PromotionStatusValue {
  return (promotionStatuses as readonly string[]).includes(value);
}

export function isPromotionScope(value: string): value is PromotionScope {
  return (promotionScopes as readonly string[]).includes(value);
}

export function isPromotionDiscountKind(
  value: string,
): value is PromotionDiscountKind {
  return (promotionDiscountKinds as readonly string[]).includes(value);
}

export function normalizePromotionCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    throw new Error(
      "Promotion code must be 3–32 characters using letters, numbers, hyphens or underscores.",
    );
  }
  return code;
}

export function promotionSnapshot(input: {
  id: string;
  code: string;
  name: string;
  scope: PromotionScope;
  discountKind: PromotionDiscountKind;
  percentageBps: number | null;
  fixedAmountMinor: bigint | null;
  currency: string | null;
  minSubtotalMinor: bigint | null;
  maxDiscountMinor: bigint | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  activeFrom: Date | null;
  activeTo: Date | null;
}) {
  return {
    promotionId: input.id,
    code: input.code,
    name: input.name,
    scope: input.scope,
    discountKind: input.discountKind,
    percentageBps: input.percentageBps,
    fixedAmountMinor: input.fixedAmountMinor?.toString() ?? null,
    currency: input.currency,
    minSubtotalMinor: input.minSubtotalMinor?.toString() ?? null,
    maxDiscountMinor: input.maxDiscountMinor?.toString() ?? null,
    maxRedemptions: input.maxRedemptions,
    perCustomerLimit: input.perCustomerLimit,
    activeFrom: input.activeFrom?.toISOString() ?? null,
    activeTo: input.activeTo?.toISOString() ?? null,
  } as const;
}

export async function savePromotion(input: {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  status: PromotionStatusValue;
  scope: PromotionScope;
  discountKind: PromotionDiscountKind;
  percentageBps?: number | null;
  fixedAmountMinor?: bigint | null;
  currency?: string | null;
  minSubtotalMinor?: bigint | null;
  maxDiscountMinor?: bigint | null;
  maxRedemptions?: number | null;
  perCustomerLimit?: number | null;
  activeFrom?: Date | null;
  activeTo?: Date | null;
  actorUserId: string;
}) {
  const code = normalizePromotionCode(input.code);
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const currency = input.currency?.trim().toUpperCase() || null;

  if (name.length < 2 || name.length > 160) {
    throw new Error("Promotion name must be between 2 and 160 characters.");
  }
  if (description && description.length > 1000) {
    throw new Error("Promotion description must be 1000 characters or fewer.");
  }

  assertPromotionRule({
    scope: input.scope,
    discountKind: input.discountKind,
    percentageBps: input.percentageBps ?? null,
    fixedAmountMinor: input.fixedAmountMinor ?? null,
    currency,
    minSubtotalMinor: input.minSubtotalMinor ?? null,
    maxDiscountMinor: input.maxDiscountMinor ?? null,
    maxRedemptions: input.maxRedemptions ?? null,
    redeemedCount: 0,
    perCustomerLimit: input.perCustomerLimit ?? null,
    activeFrom: input.activeFrom ?? null,
    activeTo: input.activeTo ?? null,
  });

  const db = getDb();

  if (input.id) {
    const existing = await db.promotion.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        code: true,
        redeemedCount: true,
      },
    });
    if (!existing) throw new Error("Promotion not found.");

    if (
      input.maxRedemptions !== null &&
      input.maxRedemptions !== undefined &&
      input.maxRedemptions < existing.redeemedCount
    ) {
      throw new Error(
        "Maximum redemptions cannot be lower than the number already redeemed.",
      );
    }

    const duplicate = await db.promotion.findFirst({
      where: {
        code,
        id: { not: input.id },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error("Promotion code is already in use.");

    const updated = await db.promotion.update({
      where: { id: input.id },
      data: {
        code,
        name,
        description,
        status: input.status,
        scope: input.scope,
        discountKind: input.discountKind,
        percentageBps:
          input.discountKind === "PERCENTAGE"
            ? (input.percentageBps ?? null)
            : null,
        fixedAmountMinor:
          input.discountKind === "FIXED"
            ? (input.fixedAmountMinor ?? null)
            : null,
        currency: input.discountKind === "FIXED" ? currency : currency,
        minSubtotalMinor: input.minSubtotalMinor ?? null,
        maxDiscountMinor: input.maxDiscountMinor ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        perCustomerLimit: input.perCustomerLimit ?? null,
        activeFrom: input.activeFrom ?? null,
        activeTo: input.activeTo ?? null,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PROMOTION_UPDATED",
        entityType: "Promotion",
        entityId: updated.id,
        metadata: {
          code: updated.code,
          status: updated.status,
          scope: updated.scope,
          discountKind: updated.discountKind,
        },
      },
    });

    return updated;
  }

  const duplicate = await db.promotion.findUnique({
    where: { code },
    select: { id: true },
  });
  if (duplicate) throw new Error("Promotion code is already in use.");

  const created = await db.promotion.create({
    data: {
      code,
      name,
      description,
      status: input.status,
      scope: input.scope,
      discountKind: input.discountKind,
      percentageBps:
        input.discountKind === "PERCENTAGE"
          ? (input.percentageBps ?? null)
          : null,
      fixedAmountMinor:
        input.discountKind === "FIXED"
          ? (input.fixedAmountMinor ?? null)
          : null,
      currency,
      minSubtotalMinor: input.minSubtotalMinor ?? null,
      maxDiscountMinor: input.maxDiscountMinor ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      activeFrom: input.activeFrom ?? null,
      activeTo: input.activeTo ?? null,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "PROMOTION_CREATED",
      entityType: "Promotion",
      entityId: created.id,
      metadata: {
        code: created.code,
        status: created.status,
        scope: created.scope,
        discountKind: created.discountKind,
      },
    },
  });

  return created;
}
