import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { checkoutSessionSigningConfigured } from "@/lib/checkout-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = {
    deploymentCommit:
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.GIT_COMMIT_SHA?.trim() ||
      null,
    deploymentEnvironment:
      process.env.VERCEL_ENV?.trim() ||
      process.env.NODE_ENV ||
      null,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    leadTableReady: false,
    activeVehicles: 0,
    activePricingRules: 0,
    activeCarBookingPolicies: 0,
    activePackageBookingPolicies: 0,
    requiredLegalPagesPublished: 0,
    checkoutSessionSigningConfigured: checkoutSessionSigningConfigured(),
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
    mediaWriteEnabled: process.env.MEDIA_WRITE_ENABLED === "true",
    storageConfigured: Boolean(
      process.env.STORAGE_PROVIDER === "s3" &&
        process.env.STORAGE_BUCKET &&
        process.env.STORAGE_REGION &&
        process.env.STORAGE_ENDPOINT &&
        process.env.STORAGE_ACCESS_KEY_ID &&
        process.env.STORAGE_SECRET_ACCESS_KEY &&
        process.env.STORAGE_PUBLIC_BASE_URL,
    ),
    scheduledPublisherConfigured: Boolean(
      process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length >= 16,
    ),
    fieldEncryptionConfigured: (() => {
      const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
      if (!raw) return false;
      try {
        return Buffer.from(raw, "base64").length === 32;
      } catch {
        return false;
      }
    })(),
    appUrlConfigured: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    leadFormsReady: false,
    carBookingReady: false,
    packageBookingReady: false,
    checkoutReady: false,
    legalReady: false,
    paymentReady: false,
    mediaReady: false,
  };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(status, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const db = getDb();

    await db.$queryRaw`SELECT 1`;
    status.databaseReachable = true;

    try {
      await db.lead.count();
      status.leadTableReady = true;
    } catch {
      status.leadTableReady = false;
    }

    const now = new Date();

    const [vehicles, pricingRules, carPolicies, packagePolicies, legalPages] =
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
        db.cmsPage.count({
          where: {
            slug: {
              in: ["privacy-policy", "terms", "cancellation-policy"],
            },
            status: "PUBLISHED",
            publishedAt: { lte: now },
          },
        }),
      ]);

    status.activeVehicles = vehicles;
    status.activePricingRules = pricingRules;
    status.activeCarBookingPolicies = carPolicies;
    status.activePackageBookingPolicies = packagePolicies;
    status.requiredLegalPagesPublished = legalPages;

    status.leadFormsReady =
      status.databaseReachable && status.leadTableReady;

    status.carBookingReady =
      status.databaseReachable &&
      status.activeVehicles > 0 &&
      status.activePricingRules > 0 &&
      status.activeCarBookingPolicies > 0 &&
      status.checkoutSessionSigningConfigured &&
      status.bookingWriteEnabled;

    status.packageBookingReady =
      status.databaseReachable &&
      status.activePackageBookingPolicies > 0 &&
      status.checkoutSessionSigningConfigured &&
      status.packageBookingWriteEnabled;

    status.checkoutReady =
      status.carBookingReady || status.packageBookingReady;

    status.legalReady = status.requiredLegalPagesPublished === 3;

    status.paymentReady =
      status.checkoutReady &&
      status.paymentWriteEnabled &&
      status.razorpayConfigured &&
      status.legalReady;

    status.mediaReady =
      status.databaseReachable &&
      status.storageConfigured &&
      status.mediaWriteEnabled;

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
