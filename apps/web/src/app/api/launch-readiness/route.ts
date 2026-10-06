import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    leadTableReady: false,
    activeVehicles: 0,
    activePricingRules: 0,
    activeCarBookingPolicies: 0,
    bookingWritesEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
    paymentWritesEnabled: process.env.PAYMENT_WRITE_ENABLED === "true",
    razorpayKeyConfigured: Boolean(process.env.RAZORPAY_KEY_ID),
    razorpaySecretConfigured: Boolean(process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    publicAppUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    failedStage: null as string | null,
  };

  if (!process.env.DATABASE_URL) {
    result.failedStage = "DATABASE_URL";
    return NextResponse.json(result, { status: 503 });
  }

  try {
    const db = getDb();
    await db.$queryRawUnsafe("SELECT 1");
    result.databaseReachable = true;

    try {
      await db.lead.count();
      result.leadTableReady = true;
    } catch {
      result.failedStage = "LEAD_TABLE";
      return NextResponse.json(result, { status: 503 });
    }

    const [vehicles, pricingRules, policies] = await Promise.all([
      db.vehicle.count({ where: { status: "ACTIVE", vehicleClass: { isActive: true } } }),
      db.pricingRule.count({ where: { status: "ACTIVE" } }),
      db.bookingPolicyVersion.count({ where: { code: "CAR_BOOKING", status: "ACTIVE" } }),
    ]);

    result.activeVehicles = vehicles;
    result.activePricingRules = pricingRules;
    result.activeCarBookingPolicies = policies;

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[launch-readiness] failed", error);
    result.failedStage = result.failedStage ?? "DATABASE_RUNTIME";
    return NextResponse.json(result, { status: 503 });
  }
}
