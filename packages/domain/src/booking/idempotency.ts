import { createHash } from "node:crypto";

export type BookingFingerprintInput = {
  quoteId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  promotionCode?: string | null;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePromotionCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() ?? "";
  return code || null;
}

export function createBookingRequestFingerprint(
  input: BookingFingerprintInput,
): string {
  const payload = JSON.stringify({
    quoteId: input.quoteId.trim(),
    guestName: normalize(input.guestName),
    guestEmail: normalize(input.guestEmail),
    guestPhone: input.guestPhone?.trim() || null,
    promotionCode: normalizePromotionCode(input.promotionCode),
  });

  return createHash("sha256").update(payload).digest("hex");
}


export function createCustomerBookingRequestFingerprint(input: {
  quoteId: string;
  customerUserId: string;
  promotionCode?: string | null;
}): string {
  const payload = JSON.stringify({
    quoteId: input.quoteId.trim(),
    customerUserId: input.customerUserId.trim(),
    promotionCode: normalizePromotionCode(input.promotionCode),
  });

  return createHash("sha256").update(payload).digest("hex");
}

export function assertIdempotentReplay(
  existingFingerprint: string,
  requestedFingerprint: string,
): void {
  if (existingFingerprint !== requestedFingerprint) {
    throw new Error(
      "Idempotency key has already been used for a different booking request.",
    );
  }
}
