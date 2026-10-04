import { createHash } from "node:crypto";

export type BookingFingerprintInput = {
  quoteId: string;
  guestName: string;
  guestEmail: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function createBookingRequestFingerprint(
  input: BookingFingerprintInput,
): string {
  const payload = JSON.stringify({
    quoteId: input.quoteId.trim(),
    guestName: normalize(input.guestName),
    guestEmail: normalize(input.guestEmail),
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
