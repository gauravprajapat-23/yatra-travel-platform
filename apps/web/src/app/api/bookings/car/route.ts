import { NextResponse } from "next/server";
import {
  BookingServiceError,
  createGuestCarBooking,
} from "@/modules/booking/car-booking-service";

export const dynamic = "force-dynamic";

type RequestBody = {
  quoteId?: unknown;
  guestName?: unknown;
  guestEmail?: unknown;
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
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.quoteId, 128)) {
    return NextResponse.json(
      { error: { code: "INVALID_QUOTE_ID", message: "quoteId is required." } },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body.guestName, 120)) {
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

  if (
    !isNonEmptyString(body.guestEmail, 254) ||
    !isEmail(body.guestEmail)
  ) {
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
    const result = await createGuestCarBooking({
      quoteId: body.quoteId.trim(),
      guestName: body.guestName.trim(),
      guestEmail: body.guestEmail.trim(),
      idempotencyKey,
    });

    const response = NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: {
        "Cache-Control": "no-store",
      },
    });

    response.cookies.set("yatra_checkout_booking", result.booking.reference, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 60,
    });

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
