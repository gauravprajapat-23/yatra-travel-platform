import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    ok: false,
    databaseReachable: false,
    leadStorageReady: false,
    fleetPublished: false,
    pricingConfigured: false,
    bookingPolicyConfigured: false,
    bookingWritesEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
    packageBookingWritesEnabled:
      process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true",
    paymentWritesEnabled: process.env.PAYMENT_WRITE_ENABLED === "true",
    razorpayKeyConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpaySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(result, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const db = getDb();
    await db.$queryRawUnsafe("SELECT 1");
    result.databaseReachable = true;

    const [leadCount, vehicleCount, pricingCount, policyCount] =
      await Promise.all([
        db.lead.count(),
        db.vehicle.count({
          where: { status: "ACTIVE", vehicleClass: { isActive: true } },
        }),
        db.pricingRule.count({ where: { status: "ACTIVE" } }),
        db.bookingPolicyVersion.count({ where: { status: "ACTIVE" } }),
      ]);

    result.leadStorageReady = leadCount >= 0;
    result.fleetPublished = vehicleCount > 0;
    result.pricingConfigured = pricingCount > 0;
    result.bookingPolicyConfigured = policyCount > 0;

    result.ok =
      result.databaseReachable &&
      result.leadStorageReady &&
      result.fleetPublished &&
      result.pricingConfigured &&
      result.bookingPolicyConfigured;

    return NextResponse.json(result, {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[launch-health] failed:",
      error instanceof Error ? error.message : "unknown runtime error",
    );

    return NextResponse.json(result, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
