import { NextResponse } from "next/server";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import { getCustomerSession } from "@/lib/auth/customer-session";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import {
  CHECKOUT_SESSION_COOKIE,
  checkoutSessionCookieOptions,
  checkoutSessionSigningConfigured,
  createCheckoutSessionToken,
} from "@/lib/checkout-session";
import {
  BookingServiceError,
  createGuestCarBooking,
} from "@/modules/booking/car-booking-service";

export const dynamic = "force-dynamic";

type RequestBody = {
  quoteId?: unknown;
  guestName?: unknown;
  guestEmail?: unknown;
  promotionCode?: unknown;
};

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function isEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

export async function POST(request: Request) {
  const rateLimit = await consumePublicWriteAttempt({
    request,
    scope: "booking_car",
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      rateLimitedResponse(rateLimit.retryAfterSeconds),
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }
  if (!checkoutSessionSigningConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "CHECKOUT_SESSION_SIGNING_UNAVAILABLE",
          message: "Secure checkout sessions are not configured.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (process.env.BOOKING_WRITE_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "BOOKING_WRITE_DISABLED",
          message: "Online booking creation is not enabled yet.",
        },
      },
      { status: 503 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();

  if (
    !idempotencyKey ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message: "A valid Idempotency-Key header is required.",
        },
      },
      { status: 400 },
    );
  }

  let body: RequestBody;
  try {
    body = await readJsonBody<RequestBody>(request, 8192);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: error.httpStatus,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    throw error;
  }

  if (!isNonEmptyString(body.quoteId, 128)) {
    return NextResponse.json(
      { error: { code: "INVALID_QUOTE_ID", message: "quoteId is required." } },
      { status: 400 },
    );
  }

  const customerSession = await getCustomerSession();
  const guestName = isNonEmptyString(body.guestName, 120)
    ? body.guestName.trim()
    : null;
  const guestEmail =
    isNonEmptyString(body.guestEmail, 254) && isEmail(body.guestEmail)
      ? body.guestEmail.trim().toLowerCase()
      : null;
  const promotionCode = isNonEmptyString(body.promotionCode, 32)
    ? body.promotionCode.trim().toUpperCase()
    : null;

  if (!customerSession && !guestName) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_GUEST_NAME",
          message: "Guest name is required.",
        },
      },
      { status: 400 },
    );
  }

  if (!customerSession && !guestEmail) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_GUEST_EMAIL",
          message: "A valid guest email is required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await createGuestCarBooking(
      customerSession
        ? {
            quoteId: body.quoteId.trim(),
            customerUserId: customerSession.userId,
            idempotencyKey,
            promotionCode,
          }
        : {
            quoteId: body.quoteId.trim(),
            guestName: guestName!,
            guestEmail: guestEmail!,
            idempotencyKey,
            promotionCode,
          },
    );

    const response = NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });

    const checkoutToken = createCheckoutSessionToken({
      bookingType: "CAR",
      bookingReference: result.booking.reference,
    });

    response.cookies.set(
      CHECKOUT_SESSION_COOKIE,
      checkoutToken,
      checkoutSessionCookieOptions(),
    );
    response.cookies.delete("yatra_checkout_booking");

    return response;
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: error.httpStatus,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "BOOKING_CREATE_FAILED",
          message: "Unable to create booking.",
        },
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
