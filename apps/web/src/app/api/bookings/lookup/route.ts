import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

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

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
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
      return NextResponse.json(
        {
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
        },
        { headers: { "Cache-Control": "no-store" } },
      );
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
      return NextResponse.json(
        {
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
        },
        { headers: { "Cache-Control": "no-store" } },
      );
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
