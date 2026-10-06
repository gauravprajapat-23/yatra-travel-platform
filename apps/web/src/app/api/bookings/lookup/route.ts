import { NextResponse } from "next/server";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import { getDb } from "@yatra/db/client";
import {
  CHECKOUT_SESSION_COOKIE,
  checkoutSessionCookieOptions,
  checkoutSessionSigningConfigured,
  createCheckoutSessionToken,
  type CheckoutBookingType,
} from "@/lib/checkout-session";
import { consumeBookingLookupAttempt } from "@/modules/booking/booking-lookup-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  reference?: unknown;
  email?: unknown;
};

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v && v.length <= max ? v : null;
}

function money(value: bigint): string {
  return value.toString();
}

function bookingResponse(input: {
  bookingType: CheckoutBookingType;
  reference: string;
  status: string;
  booking: Record<string, unknown>;
}) {
  const resumePayment =
    input.status === "PENDING_PAYMENT" &&
    checkoutSessionSigningConfigured();

  const response = NextResponse.json(
    {
      booking: input.booking,
      resumePayment,
    },
    { headers: { "Cache-Control": "no-store" } },
  );

  if (resumePayment) {
    const token = createCheckoutSessionToken({
      bookingType: input.bookingType,
      bookingReference: input.reference,
    });

    response.cookies.set(
      CHECKOUT_SESSION_COOKIE,
      token,
      checkoutSessionCookieOptions(),
    );
    response.cookies.delete("yatra_checkout_booking");
  }

  return response;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await readJsonBody<Body>(request, 4096);
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

  const reference = str(body.reference, 64)?.toUpperCase() ?? null;
  const email = str(body.email, 254)?.toLowerCase() ?? null;

  if (!reference || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: { code: "INVALID_LOOKUP", message: "Booking reference and registered email are required." } },
      { status: 400 },
    );
  }

  try {
    const limit = await consumeBookingLookupAttempt(request);

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "LOOKUP_RATE_LIMITED",
            message: "Too many booking lookup attempts. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const db = getDb();

    const car = await db.carBooking.findFirst({
      where: { reference, guestEmail: email },
      select: {
        reference: true,
        status: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        endsAt: true,
        travellers: true,
        currency: true,
        totalMinor: true,
        confirmedAt: true,
        createdAt: true,
        vehicleClass: { select: { name: true } },
      },
    });

    if (car) {
      return bookingResponse({
        bookingType: "CAR",
        reference: car.reference,
        status: car.status,
        booking: {
          type: "CAR",
          reference: car.reference,
          status: car.status,
          title: car.vehicleClass.name,
          route: `${car.originText} → ${car.destinationText}`,
          startsAt: car.startsAt.toISOString(),
          endsAt: car.endsAt?.toISOString() ?? null,
          travellers: car.travellers,
          currency: car.currency,
          totalMinor: money(car.totalMinor),
          confirmedAt: car.confirmedAt?.toISOString() ?? null,
          createdAt: car.createdAt.toISOString(),
        },
      });
    }

    const pkg = await db.packageBooking.findFirst({
      where: { reference, guestEmail: email },
      select: {
        reference: true,
        status: true,
        travelStartAt: true,
        travellers: true,
        currency: true,
        totalMinor: true,
        confirmedAt: true,
        createdAt: true,
        package: { select: { title: true } },
      },
    });

    if (pkg) {
      return bookingResponse({
        bookingType: "PACKAGE",
        reference: pkg.reference,
        status: pkg.status,
        booking: {
          type: "PACKAGE",
          reference: pkg.reference,
          status: pkg.status,
          title: pkg.package.title,
          route: "Tour package",
          startsAt: pkg.travelStartAt.toISOString(),
          endsAt: null,
          travellers: pkg.travellers,
          currency: pkg.currency,
          totalMinor: money(pkg.totalMinor),
          confirmedAt: pkg.confirmedAt?.toISOString() ?? null,
          createdAt: pkg.createdAt.toISOString(),
        },
      });
    }

    return NextResponse.json(
      {
        error: {
          code: "BOOKING_NOT_FOUND",
          message: "No booking matched that reference and email.",
        },
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[booking-lookup] failed", error);
    return NextResponse.json(
      { error: { code: "LOOKUP_FAILED", message: "Unable to look up booking." } },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
