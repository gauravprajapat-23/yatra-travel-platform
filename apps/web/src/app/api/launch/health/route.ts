import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    leadTableReady: false,
    activeVehicleCount: 0,
    activePricingRuleCount: 0,
    activeCarBookingPolicy: false,
    bookingWritesEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
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
      result.leadTableReady = true;
    } catch {
      result.leadTableReady = false;
    }

    result.activeVehicleCount = await db.vehicle.count({
      where: {
        status: "ACTIVE",
        vehicleClass: { isActive: true },
      },
    });

    result.activePricingRuleCount = await db.pricingRule.count({
      where: { status: "ACTIVE" },
    });

    const now = new Date();
    result.activeCarBookingPolicy = Boolean(
      await db.bookingPolicyVersion.findFirst({
        where: {
          code: "CAR_BOOKING",
          status: "ACTIVE",
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
          AND: [
            {
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
            },
          ],
        },
        select: { id: true },
      }),
    );

    const readyForLeadLaunch =
      result.databaseReachable &&
      result.leadTableReady;

    return NextResponse.json(result, {
      status: readyForLeadLaunch ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      "[launch-health] failed",
      error instanceof Error ? error.message : "Unknown runtime error",
    );
    return NextResponse.json(result, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
