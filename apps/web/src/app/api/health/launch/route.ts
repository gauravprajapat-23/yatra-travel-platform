import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    leadTableReady: false,
    activeVehicles: 0,
    activePricingRules: 0,
    activeCarBookingPolicies: 0,
    activePackageBookingPolicies: 0,
    bookingWriteEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
    packageBookingWriteEnabled:
      process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true",
    paymentWriteEnabled: process.env.PAYMENT_WRITE_ENABLED === "true",
    refundWriteEnabled: process.env.REFUND_WRITE_ENABLED === "true",
    razorpayConfigured: Boolean(
      process.env.RAZORPAY_KEY_ID &&
        process.env.RAZORPAY_KEY_SECRET &&
        process.env.RAZORPAY_WEBHOOK_SECRET,
    ),
    appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    leadFormsReady: false,
    carBookingReady: false,
    packageBookingReady: false,
    checkoutReady: false,
    paymentReady: false,
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(status, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const db = getDb();

    await db.$queryRawUnsafe("SELECT 1");
    status.databaseReachable = true;

    try {
      await db.lead.count();
      status.leadTableReady = true;
    } catch {
      status.leadTableReady = false;
    }

    const [vehicles, pricingRules, carPolicies, packagePolicies] =
      await Promise.all([
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
        db.bookingPolicyVersion.count({
          where: {
            code: "PACKAGE_BOOKING",
            status: "ACTIVE",
          },
        }),
      ]);

    status.activeVehicles = vehicles;
    status.activePricingRules = pricingRules;
    status.activeCarBookingPolicies = carPolicies;
    status.activePackageBookingPolicies = packagePolicies;

    status.leadFormsReady =
      status.databaseReachable && status.leadTableReady;

    status.carBookingReady =
      status.databaseReachable &&
      status.activeVehicles > 0 &&
      status.activePricingRules > 0 &&
      status.activeCarBookingPolicies > 0 &&
      status.bookingWriteEnabled;

    status.packageBookingReady =
      status.databaseReachable &&
      status.activePackageBookingPolicies > 0 &&
      status.packageBookingWriteEnabled;

    status.checkoutReady =
      status.carBookingReady || status.packageBookingReady;

    status.paymentReady =
      status.checkoutReady &&
      status.paymentWriteEnabled &&
      status.razorpayConfigured;

    return NextResponse.json(status, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[launch-health] database check failed",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(status, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
