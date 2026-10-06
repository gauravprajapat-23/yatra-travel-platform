import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export type CheckoutBookingType = "CAR" | "PACKAGE";

export const CHECKOUT_SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-yatra_checkout"
    : "yatra_checkout";

const VERSION = 1;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

type CheckoutSessionPayload = {
  v: number;
  t: CheckoutBookingType;
  r: string;
  e: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured with at least 32 characters for checkout session signing.",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "base64url");
    const right = Buffer.from(b, "base64url");

    return (
      left.length === right.length &&
      left.length > 0 &&
      timingSafeEqual(left, right)
    );
  } catch {
    return false;
  }
}

export function checkoutSessionSigningConfigured(): boolean {
  const secret = process.env.AUTH_SECRET?.trim();
  return Boolean(secret && secret.length >= 32);
}

export function createCheckoutSessionToken(input: {
  bookingType: CheckoutBookingType;
  bookingReference: string;
  ttlMs?: number;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;

  if (
    !input.bookingReference ||
    input.bookingReference.length > 64 ||
    ttlMs <= 0 ||
    ttlMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error("Invalid checkout session input.");
  }

  const payload: CheckoutSessionPayload = {
    v: VERSION,
    t: input.bookingType,
    r: input.bookingReference.trim().toUpperCase(),
    e: now + ttlMs,
  };

  const encoded = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function verifyCheckoutSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): CheckoutSessionPayload | null {
  if (!token || token.length > 1024) return null;

  const [encoded, signature, ...extra] = token.split(".");
  if (!encoded || !signature || extra.length > 0) return null;

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    return null;
  }

  if (!safeEqual(signature, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const value = payload as Partial<CheckoutSessionPayload>;

  if (
    value.v !== VERSION ||
    (value.t !== "CAR" && value.t !== "PACKAGE") ||
    typeof value.r !== "string" ||
    !value.r ||
    value.r.length > 64 ||
    typeof value.e !== "number" ||
    !Number.isFinite(value.e) ||
    value.e <= now
  ) {
    return null;
  }

  return {
    v: VERSION,
    t: value.t,
    r: value.r.trim().toUpperCase(),
    e: value.e,
  };
}

export function checkoutSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEFAULT_TTL_MS / 1000,
  };
}
