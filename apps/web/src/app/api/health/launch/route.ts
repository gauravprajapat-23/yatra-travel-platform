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
    activePromotions: 0,
    openPackageDepartures: 0,
    fleetComplianceBlockers: 0,
    requiredLegalPagesPublished: 0,
    checkoutSessionSigningConfigured: checkoutSessionSigningConfigured(),
    bookingWriteEnabled: process.env.BOOKING_WRITE_ENABLED === "true",
    packageBookingWriteEnabled:
      process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true",
    paymentWriteEnabled: process.env.PAYMENT_WRITE_ENABLED === "true",
    refundWriteEnabled: process.env.REFUND_WRITE_ENABLED === "true",
    customerAuthWriteEnabled:
      process.env.CUSTOMER_AUTH_WRITE_ENABLED === "true",
    customerPasswordResetEnabled:
      process.env.CUSTOMER_PASSWORD_RESET_ENABLED === "true",
    promotionApplyEnabled:
      process.env.PROMOTION_APPLY_ENABLED === "true",
    notificationEmailProviderConfigured: Boolean(
      process.env.NOTIFICATION_EMAIL_PROVIDER?.trim().toLowerCase() ===
        "resend" &&
        process.env.RESEND_API_KEY?.trim() &&
        process.env.NOTIFICATION_EMAIL_FROM?.trim(),
    ),
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
    scheduledPublisherLastRunAt: null as string | null,
    scheduledPublisherRecentlyRan: false,
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
    fullBookingReady: false,
    legalReady: false,
    carPaymentReady: false,
    packagePaymentReady: false,
    paymentReady: false,
    fullPaymentReady: false,
    refundReady: false,
    mediaReady: false,
    customerAuthReady: false,
    passwordResetReady: false,
    promotionReady: false,
    packageDepartureReady: false,
    fleetComplianceReady: false,
    crmReady: false,
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

    const [
      vehicles,
      pricingRules,
      carPolicies,
      packagePolicies,
      legalPages,
      scheduledPublisherHeartbeat,
      activePromotions,
      openPackageDepartures,
      fleetComplianceBlockers,
      crmInteractionCount,
      crmFollowUpCount,
    ] = await Promise.all([
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
        db.auditLog.findFirst({
          where: {
            action: "SCHEDULED_PUBLISHER_RUN",
            entityType: "Scheduler",
            entityId: "publish-content",
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        db.promotion.count({
          where: {
            status: "ACTIVE",
            OR: [
              { activeFrom: null },
              { activeFrom: { lte: now } },
            ],
            AND: [
              {
                OR: [
                  { activeTo: null },
                  { activeTo: { gt: now } },
                ],
              },
            ],
          },
        }),
        db.packageDeparture.count({
          where: {
            status: "OPEN",
            startsAt: { gt: now },
          },
        }),
        db.vehicleComplianceDocument.count({
          where: {
            blocksDispatch: true,
            expiresAt: { not: null, lte: now },
            vehicle: { status: { not: "RETIRED" } },
          },
        }),
        db.crmInteraction.count(),
        db.crmFollowUpTask.count(),
      ]);

    status.activeVehicles = vehicles;
    status.activePricingRules = pricingRules;
    status.activeCarBookingPolicies = carPolicies;
    status.activePackageBookingPolicies = packagePolicies;
    status.activePromotions = activePromotions;
    status.openPackageDepartures = openPackageDepartures;
    status.fleetComplianceBlockers = fleetComplianceBlockers;
    status.requiredLegalPagesPublished = legalPages;

    if (scheduledPublisherHeartbeat) {
      status.scheduledPublisherLastRunAt =
        scheduledPublisherHeartbeat.createdAt.toISOString();
      status.scheduledPublisherRecentlyRan =
        now.getTime() - scheduledPublisherHeartbeat.createdAt.getTime() <=
        36 * 60 * 60 * 1000;
    }

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

    status.fullBookingReady =
      status.carBookingReady && status.packageBookingReady;

    status.legalReady = status.requiredLegalPagesPublished === 3;

    status.carPaymentReady =
      status.carBookingReady &&
      status.paymentWriteEnabled &&
      status.razorpayConfigured &&
      status.legalReady;

    status.packagePaymentReady =
      status.packageBookingReady &&
      status.paymentWriteEnabled &&
      status.razorpayConfigured &&
      status.legalReady;

    status.paymentReady =
      status.carPaymentReady || status.packagePaymentReady;

    status.fullPaymentReady =
      status.carPaymentReady && status.packagePaymentReady;

    status.refundReady =
      status.databaseReachable &&
      status.refundWriteEnabled &&
      status.razorpayConfigured;

    status.mediaReady =
      status.databaseReachable &&
      status.storageConfigured &&
      status.mediaWriteEnabled;

    status.customerAuthReady =
      status.databaseReachable &&
      status.checkoutSessionSigningConfigured &&
      status.customerAuthWriteEnabled &&
      status.notificationEmailProviderConfigured;

    status.passwordResetReady =
      status.customerAuthReady &&
      status.customerPasswordResetEnabled;

    status.promotionReady =
      status.databaseReachable &&
      status.promotionApplyEnabled &&
      status.activePromotions > 0;

    status.packageDepartureReady =
      status.databaseReachable &&
      status.openPackageDepartures > 0;

    status.fleetComplianceReady =
      status.databaseReachable &&
      status.fleetComplianceBlockers === 0;

    status.crmReady =
      status.databaseReachable &&
      status.leadTableReady &&
      crmInteractionCount >= 0 &&
      crmFollowUpCount >= 0;

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
