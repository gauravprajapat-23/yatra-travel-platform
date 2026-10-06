import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { selectPricingRule } from "@yatra/domain/pricing/rule-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  origin?: unknown;
  destination?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  travellers?: unknown;
  tripType?: unknown;
  vehicleSlug?: unknown;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function date(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysInclusive(startsAt: Date, endsAt: Date | null): number {
  if (!endsAt) return 1;
  const diff = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

function ttlMinutes(): number {
  const configured = Number(process.env.CAR_QUOTE_TTL_MINUTES ?? "30");
  return Number.isInteger(configured) && configured >= 5 && configured <= 1440
    ? configured
    : 30;
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: { code: "DATABASE_NOT_CONFIGURED", message: "Quote service is unavailable." } },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const origin = text(body.origin, 120);
  const destination = text(body.destination, 120);
  const startsAt = date(body.startsAt);
  const endsAt = body.endsAt ? date(body.endsAt) : null;
  const vehicleSlug = text(body.vehicleSlug, 120);
  const travellers = Number(body.travellers);
  const tripType =
    body.tripType === "ONE_WAY" || body.tripType === "ROUND_TRIP"
      ? body.tripType
      : null;

  if (!origin || !destination || !startsAt || !vehicleSlug || !tripType) {
    return NextResponse.json(
      { error: { code: "INVALID_QUOTE_INPUT", message: "Route, date, trip type and vehicle are required." } },
      { status: 400 },
    );
  }

  if (!Number.isInteger(travellers) || travellers < 1 || travellers > 30) {
    return NextResponse.json(
      { error: { code: "INVALID_TRAVELLERS", message: "Travellers must be between 1 and 30." } },
      { status: 400 },
    );
  }

  if (endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { error: { code: "INVALID_DATE_RANGE", message: "Return date cannot be before departure." } },
      { status: 400 },
    );
  }

  try {
    const db = getDb();

    const vehicle = await db.vehicle.findFirst({
      where: {
        slug: vehicleSlug,
        status: "ACTIVE",
        vehicleClass: { isActive: true },
      },
      include: { vehicleClass: true },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: { code: "VEHICLE_UNAVAILABLE", message: "The selected vehicle is not currently available for quoting." } },
        { status: 404 },
      );
    }

    if (travellers > vehicle.seats) {
      return NextResponse.json(
        { error: { code: "VEHICLE_CAPACITY_EXCEEDED", message: "The selected vehicle does not have enough seats." } },
        { status: 409 },
      );
    }

    const rules = await db.pricingRule.findMany({
      where: {
        vehicleClassId: vehicle.vehicleClassId,
        tripType,
        status: "ACTIVE",
      },
    });

    const selected = selectPricingRule(
      rules.map((rule) => ({
        id: rule.id,
        vehicleClassId: rule.vehicleClassId,
        tripType: rule.tripType,
        basis: rule.basis,
        currency: rule.currency,
        originKey: rule.originKey,
        destinationKey: rule.destinationKey,
        priority: rule.priority,
        status: rule.status,
        activeFrom: rule.activeFrom,
        activeTo: rule.activeTo,
      })),
      {
        vehicleClassId: vehicle.vehicleClassId,
        tripType,
        originKey: origin.toLowerCase(),
        destinationKey: destination.toLowerCase(),
        at: new Date(),
      },
    );

    if (!selected) {
      return NextResponse.json(
        {
          error: {
            code: "NO_PRICING_RULE",
            message: "No active pricing rule is configured for this vehicle and route.",
          },
        },
        { status: 409 },
      );
    }

    const rule = rules.find((item) => item.id === selected.id);
    if (!rule) {
      return NextResponse.json(
        { error: { code: "PRICING_RULE_RESOLUTION_FAILED", message: "Unable to resolve pricing." } },
        { status: 500 },
      );
    }

    if (rule.basis === "QUOTE_ONLY") {
      return NextResponse.json(
        {
          error: {
            code: "MANUAL_QUOTE_REQUIRED",
            message: "This route requires a custom quote from the YATRA team.",
          },
        },
        { status: 409 },
      );
    }

    if (rule.basis === "PER_KM") {
      return NextResponse.json(
        {
          error: {
            code: "ROUTE_DISTANCE_REQUIRED",
            message: "Automatic per-kilometre quoting is not enabled until a trusted server-side distance provider is configured.",
          },
        },
        { status: 409 },
      );
    }

    if (rule.basis !== "FIXED" || rule.baseAmountMinor === null) {
      return NextResponse.json(
        { error: { code: "PRICING_CONFIGURATION_INVALID", message: "Pricing configuration is incomplete." } },
        { status: 503 },
      );
    }

    const tripDays = daysInclusive(startsAt, endsAt);
    const driverAllowance =
      (rule.driverAllowancePerDayMinor ?? 0n) * BigInt(tripDays);
    const nightAllowance =
      (rule.nightAllowanceMinor ?? 0n) * BigInt(Math.max(0, tripDays - 1));
    const subtotalMinor = rule.baseAmountMinor + driverAllowance + nightAllowance;
    const discountMinor = 0n;
    const taxMinor = 0n;
    const totalMinor = subtotalMinor;

    const expiresAt = new Date(Date.now() + ttlMinutes() * 60_000);

    const quote = await db.carQuote.create({
      data: {
        tripType,
        originText: origin,
        destinationText: destination,
        startsAt,
        endsAt,
        travellers,
        vehicleClassId: vehicle.vehicleClassId,
        pricingRuleId: rule.id,
        currency: rule.currency,
        subtotalMinor,
        discountMinor,
        taxMinor,
        totalMinor,
        priceBreakdown: {
          basis: rule.basis,
          baseAmountMinor: rule.baseAmountMinor.toString(),
          driverAllowanceMinor: driverAllowance.toString(),
          nightAllowanceMinor: nightAllowance.toString(),
          tripDays,
          selectedVehicleSlug: vehicle.slug,
        },
        expiresAt,
      },
    });

    return NextResponse.json(
      {
        quote: {
          id: quote.id,
          vehicle: {
            slug: vehicle.slug,
            displayName: vehicle.displayName,
            seats: vehicle.seats,
            luggage: vehicle.luggage,
            airConditioned: vehicle.airConditioned,
            vehicleClass: vehicle.vehicleClass.name,
          },
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
    console.error("[car-quote] create failed", error);
    return NextResponse.json(
      { error: { code: "QUOTE_CREATE_FAILED", message: "Unable to create a quote." } },
      { status: 500 },
    );
  }
}
