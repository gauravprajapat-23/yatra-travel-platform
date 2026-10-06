import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    leadsReady: false,
    activeVehicles: 0,
    activeVehicleClasses: 0,
    activePricingRules: 0,
    fixedPricingRules: 0,
    quoteOnlyPricingRules: 0,
    activeBookingPolicy: false,
    bookingWriteEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
    packageBookingWriteEnabled:
      process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true",
    paymentWriteEnabled: process.env.PAYMENT_WRITE_ENABLED === "true",
    razorpayKeyConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpaySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(state, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const db = getDb();
    await db.$queryRawUnsafe("SELECT 1");
    state.databaseReachable = true;

    const [
      leadCount,
      activeVehicles,
      activeVehicleClasses,
      activePricingRules,
      fixedPricingRules,
      quoteOnlyPricingRules,
      activeBookingPolicies,
    ] = await Promise.all([
      db.lead.count(),
      db.vehicle.count({ where: { status: "ACTIVE" } }),
      db.vehicleClass.count({ where: { isActive: true } }),
      db.pricingRule.count({ where: { status: "ACTIVE" } }),
      db.pricingRule.count({
        where: { status: "ACTIVE", basis: "FIXED" },
      }),
      db.pricingRule.count({
        where: { status: "ACTIVE", basis: "QUOTE_ONLY" },
      }),
      db.bookingPolicyVersion.count({
        where: {
          code: "CAR_BOOKING",
          status: "ACTIVE",
        },
      }),
    ]);

    state.leadsReady = leadCount >= 0;
    state.activeVehicles = activeVehicles;
    state.activeVehicleClasses = activeVehicleClasses;
    state.activePricingRules = activePricingRules;
    state.fixedPricingRules = fixedPricingRules;
    state.quoteOnlyPricingRules = quoteOnlyPricingRules;
    state.activeBookingPolicy = activeBookingPolicies > 0;

    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[launch-readiness] check failed",
      error instanceof Error ? error.message : "Unknown runtime error",
    );

    return NextResponse.json(state, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
