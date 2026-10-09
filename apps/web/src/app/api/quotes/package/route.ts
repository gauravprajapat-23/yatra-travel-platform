import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import {
  assertTravellerRange,
  calculatePackageBasePrice,
} from "@yatra/domain/package/pricing";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import { departureSnapshot } from "@/modules/packages/package-departure-inventory-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  packageSlug?: unknown;
  priceOptionId?: unknown;
  departureId?: unknown;
  travellers?: unknown;
  vehicleCount?: unknown;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function ttlMinutes(): number {
  const configured = Number(process.env.PACKAGE_QUOTE_TTL_MINUTES ?? "30");
  return Number.isInteger(configured) && configured >= 5 && configured <= 1440
    ? configured
    : 30;
}

export async function POST(request: Request) {
  const rateLimit = await consumePublicWriteAttempt({
    request,
    scope: "quote_package",
    maxAttempts: 60,
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

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_NOT_CONFIGURED",
          message: "Quote service is unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: Body;
  try {
    body = await readJsonBody<Body>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        {
          status: error.httpStatus,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    throw error;
  }

  const packageSlug = text(body.packageSlug, 120);
  const priceOptionId = text(body.priceOptionId, 128);
  const departureId = text(body.departureId, 128);
  const travellers = Number(body.travellers);
  const vehicleCount =
    body.vehicleCount === undefined || body.vehicleCount === null
      ? null
      : Number(body.vehicleCount);

  if (!packageSlug || !priceOptionId || !departureId) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PACKAGE_QUOTE_INPUT",
          message: "Package, price option and departure are required.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 100) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TRAVELLERS",
          message: "Travellers must be between 1 and 100.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    vehicleCount !== null &&
    (!Number.isInteger(vehicleCount) || vehicleCount < 1 || vehicleCount > 50)
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_VEHICLE_COUNT",
          message: "Vehicle count must be between 1 and 50.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const db = getDb();
    const now = new Date();

    const pkg = await db.tourPackage.findFirst({
      where: {
        slug: packageSlug,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        slug: true,
        title: true,
        priceOptions: {
          where: {
            id: priceOptionId,
            isActive: true,
          },
          take: 1,
        },
        departures: {
          where: { id: departureId },
          take: 1,
        },
      },
    });

    if (!pkg) {
      return NextResponse.json(
        {
          error: {
            code: "PACKAGE_UNAVAILABLE",
            message: "The selected package is not available for quoting.",
          },
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const priceOption = pkg.priceOptions[0];
    if (!priceOption) {
      return NextResponse.json(
        {
          error: {
            code: "PRICE_OPTION_UNAVAILABLE",
            message: "The selected package price option is unavailable.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const departure = pkg.departures[0];
    if (!departure) {
      return NextResponse.json(
        {
          error: {
            code: "DEPARTURE_UNAVAILABLE",
            message: "The selected departure is unavailable.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (
      departure.status !== "OPEN" ||
      departure.startsAt <= now ||
      (departure.salesOpenAt && now < departure.salesOpenAt) ||
      (departure.salesCloseAt && now >= departure.salesCloseAt)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "DEPARTURE_NOT_SELLABLE",
            message: "The selected departure is not currently open for sale.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const remainingCapacity =
      departure.capacityTravellers === null
        ? null
        : departure.capacityTravellers - departure.reservedTravellers;

    if (remainingCapacity !== null && travellers > remainingCapacity) {
      return NextResponse.json(
        {
          error: {
            code: "DEPARTURE_CAPACITY_EXCEEDED",
            message: "The selected departure does not have enough remaining capacity.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      assertTravellerRange({
        travellers,
        minTravellers: priceOption.minTravellers,
        maxTravellers: priceOption.maxTravellers,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: "TRAVELLER_RANGE_INVALID",
            message:
              error instanceof Error
                ? error.message
                : "Traveller count is not eligible for this price option.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    let basePrice;
    try {
      basePrice = calculatePackageBasePrice({
        mode: priceOption.mode,
        amountMinor: priceOption.amountMinor,
        travellers,
        vehicleCount,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: "PACKAGE_PRICING_INPUT_INVALID",
            message:
              error instanceof Error
                ? error.message
                : "Unable to calculate package pricing.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const discountMinor = 0n;
    const taxMinor = 0n;
    const totalMinor = basePrice.subtotalMinor;
    const snapshot = departureSnapshot(departure);
    const expiresAt = new Date(Date.now() + ttlMinutes() * 60_000);

    const quote = await db.packageQuote.create({
      data: {
        packageId: pkg.id,
        priceOptionId: priceOption.id,
        travellers,
        vehicleCount,
        quantity: basePrice.quantity,
        travelStartAt: departure.startsAt,
        departureId: departure.id,
        departureSnapshot: snapshot,
        currency: priceOption.currency,
        subtotalMinor: basePrice.subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        priceBreakdown: {
          mode: priceOption.mode,
          amountMinor: priceOption.amountMinor.toString(),
          quantity: basePrice.quantity,
          travellers,
          vehicleCount,
          departureId: departure.id,
        },
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        quote: {
          id: quote.id,
          package: {
            slug: pkg.slug,
            title: pkg.title,
          },
          departure: {
            id: departure.id,
            startsAt: departure.startsAt.toISOString(),
            endsAt: departure.endsAt?.toISOString() ?? null,
            remainingCapacity,
          },
          priceOption: {
            id: priceOption.id,
            mode: priceOption.mode,
          },
          travellers,
          vehicleCount,
          quantity: basePrice.quantity,
          currency: quote.currency,
          subtotalMinor: quote.subtotalMinor.toString(),
          discountMinor: quote.discountMinor.toString(),
          taxMinor: quote.taxMinor.toString(),
          totalMinor: quote.totalMinor.toString(),
          expiresAt: quote.expiresAt.toISOString(),
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[package-quote] create failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error: {
          code: "PACKAGE_QUOTE_CREATE_FAILED",
          message: "Unable to create a package quote.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
