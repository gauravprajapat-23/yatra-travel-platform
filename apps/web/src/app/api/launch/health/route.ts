import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    ok: false,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    leadStorageReady: false,
    activeVehicleCount: 0,
    activePricingRuleCount: 0,
    activeCarBookingPolicy: false,
    bookingWritesEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
    packageBookingWritesEnabled:
      process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true",
    paymentWritesEnabled: process.env.PAYMENT_WRITE_ENABLED === "true",
    razorpayKeyConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpaySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(result, { status: 503 });
  }

  try {
    const db = getDb();
    await db.$queryRawUnsafe("SELECT 1");
    result.databaseReachable = true;

    try {
      await db.lead.count();
      result.leadStorageReady = true;
    } catch {
      result.leadStorageReady = false;
    }

    const [vehicleCount, pricingRuleCount, policyCount] = await Promise.all([
      db.vehicle.count({
        where: {
          status: "ACTIVE",
          vehicleClass: { isActive: true },
        },
      }),
      db.pricingRule.count({
        where: { status: "ACTIVE" },
      }),
      db.bookingPolicyVersion.count({
        where: {
          code: "CAR_BOOKING",
          status: "ACTIVE",
        },
      }),
    ]);

    result.activeVehicleCount = vehicleCount;
    result.activePricingRuleCount = pricingRuleCount;
    result.activeCarBookingPolicy = policyCount > 0;

    result.ok =
      result.databaseReachable &&
      result.leadStorageReady &&
      result.activeVehicleCount > 0 &&
      result.activePricingRuleCount > 0 &&
      result.activeCarBookingPolicy;

    return NextResponse.json(result, {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[launch-health] check failed:",
      error instanceof Error ? error.message : "Unknown runtime error",
    );
    return NextResponse.json(result, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
