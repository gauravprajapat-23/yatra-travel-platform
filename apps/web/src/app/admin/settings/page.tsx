import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { checkoutSessionSigningConfigured } from "@/lib/checkout-session";

export const dynamic = "force-dynamic";

function yesNo(value: boolean) {
  return value ? "Configured" : "Missing";
}

function gate(value: boolean) {
  return value ? "Enabled" : "Disabled";
}

export default async function SettingsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const db = getDb();
  const now = new Date();

  const [
    carPolicies,
    packagePolicies,
    legalPages,
    activePricingRules,
    activeVehicles,
    staffCount,
    dueCms,
    dueBlog,
    dueDestinations,
    duePackages,
    dueFaqs,
    schedulerHeartbeat,
  ] = await Promise.all([
    db.bookingPolicyVersion.count({
      where: { code: "CAR_BOOKING", status: "ACTIVE" },
    }),
    db.bookingPolicyVersion.count({
      where: { code: "PACKAGE_BOOKING", status: "ACTIVE" },
    }),
    db.cmsPage.count({
      where: {
        slug: { in: ["privacy-policy", "terms", "cancellation-policy"] },
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
    }),
    db.pricingRule.count({ where: { status: "ACTIVE" } }),
    db.vehicle.count({
      where: {
        status: "ACTIVE",
        vehicleClass: { isActive: true },
      },
    }),
    db.user.count({
      where: {
        roles: {
          some: {
            role: { key: { not: "CUSTOMER" } },
          },
        },
      },
    }),
    db.cmsPage.count({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    }),
    db.blogPost.count({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    }),
    db.destination.count({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    }),
    db.tourPackage.count({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    }),
    db.faq.count({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
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
  ]);

  const razorpayConfigured = Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET,
  );
  const storageConfigured = Boolean(
    process.env.STORAGE_PROVIDER === "s3" &&
      process.env.STORAGE_BUCKET &&
      process.env.STORAGE_REGION &&
      process.env.STORAGE_ENDPOINT &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY &&
      process.env.STORAGE_PUBLIC_BASE_URL,
  );
  const appUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);
  const checkoutSigningConfigured = checkoutSessionSigningConfigured();
  const schedulerConfigured = Boolean(
    process.env.CRON_SECRET && process.env.CRON_SECRET.trim().length >= 16,
  );
  const overdueScheduledContent =
    dueCms + dueBlog + dueDestinations + duePackages + dueFaqs;
  const schedulerRecentlyRan = Boolean(
    schedulerHeartbeat &&
      now.getTime() - schedulerHeartbeat.createdAt.getTime() <=
        36 * 60 * 60 * 1000,
  );
  const schedulerReady = schedulerConfigured && schedulerRecentlyRan;
  const schedulerDetail = schedulerHeartbeat
    ? `last run ${schedulerHeartbeat.createdAt.toLocaleString("en-IN")} · ${overdueScheduledContent} due`
    : `never ran · ${overdueScheduledContent} due`;
  const fieldEncryptionConfigured = (() => {
    const raw = process.env.FIELD_ENCRYPTION_KEY?.trim();
    if (!raw) return false;
    try {
      return Buffer.from(raw, "base64").length === 32;
    } catch {
      return false;
    }
  })();

  const bookingWriteEnabled = process.env.BOOKING_WRITE_ENABLED === "true";
  const packageBookingWriteEnabled =
    process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true";
  const paymentWriteEnabled = process.env.PAYMENT_WRITE_ENABLED === "true";
  const refundWriteEnabled = process.env.REFUND_WRITE_ENABLED === "true";
  const mediaWriteEnabled = process.env.MEDIA_WRITE_ENABLED === "true";

  const legalReady = legalPages === 3;
  const carReady =
    bookingWriteEnabled &&
    checkoutSigningConfigured &&
    carPolicies > 0 &&
    activePricingRules > 0 &&
    activeVehicles > 0;
  const packageReady =
    packageBookingWriteEnabled &&
    checkoutSigningConfigured &&
    packagePolicies > 0;
  const fullBookingReady = carReady && packageReady;

  const carPaymentReady =
    carReady &&
    paymentWriteEnabled &&
    razorpayConfigured &&
    legalReady;
  const packagePaymentReady =
    packageReady &&
    paymentWriteEnabled &&
    razorpayConfigured &&
    legalReady;
  const paymentReady = carPaymentReady || packagePaymentReady;
  const fullPaymentReady = carPaymentReady && packagePaymentReady;
  const refundReady = refundWriteEnabled && razorpayConfigured;

  const configRows = [
    ["Application URL", yesNo(appUrlConfigured), "NEXT_PUBLIC_APP_URL"],
    [
      "Checkout Session Signing",
      yesNo(checkoutSigningConfigured),
      "AUTH_SECRET with at least 32 characters",
    ],
    ["Razorpay", yesNo(razorpayConfigured), "Key ID + secret + webhook secret"],
    ["S3 Storage", yesNo(storageConfigured), "Bucket, endpoint, credentials, public base URL"],
    ["Field Encryption", yesNo(fieldEncryptionConfigured), "32-byte AES-256-GCM key for driver phone/license fields"],
    [
      "Scheduled Publisher",
      schedulerReady
        ? "Ready"
        : schedulerConfigured
          ? "Configured · not running"
          : "Missing",
      schedulerDetail,
    ],
    ["Required Legal Pages", legalReady ? "Ready" : `${legalPages}/3 published`, "Privacy, Terms, Cancellation"],
    ["Car Booking Policy", carPolicies > 0 ? "Ready" : "Missing", `${carPolicies} active`],
    ["Package Booking Policy", packagePolicies > 0 ? "Ready" : "Missing", `${packagePolicies} active`],
    ["Active Pricing Rules", activePricingRules > 0 ? "Ready" : "Missing", activePricingRules.toString()],
    ["Active Vehicles", activeVehicles > 0 ? "Ready" : "Missing", activeVehicles.toString()],
  ];

  const gateRows = [
    ["Car booking writes", gate(bookingWriteEnabled)],
    ["Package booking writes", gate(packageBookingWriteEnabled)],
    ["Payment writes", gate(paymentWriteEnabled)],
    ["Refund writes", gate(refundWriteEnabled)],
    ["Media writes", gate(mediaWriteEnabled)],
  ];

  return (
    <AdminShell
      active="Settings"
      title="Settings & Runtime Configuration"
      subtitle="Production configuration status. Secrets are never displayed or editable from the admin UI."
      actions={
        <Link
          className="admin-primary-button"
          href="/admin/settings/booking-policies"
        >
          Booking Policies
        </Link>
      }
    >
      <div className="admin-metric-grid">
        <AdminMetric
          label="Booking Channels"
          value={
            fullBookingReady
              ? "Both Ready"
              : carReady
                ? "Car Only"
                : packageReady
                  ? "Package Only"
                  : "Blocked"
          }
          meta="write gate + signed checkout + active policy prerequisites"
          tone={fullBookingReady ? "green" : carReady || packageReady ? "orange" : "red"}
        />
        <AdminMetric
          label="Payment Channels"
          value={
            fullPaymentReady
              ? "Both Ready"
              : carPaymentReady
                ? "Car Only"
                : packagePaymentReady
                  ? "Package Only"
                  : "Blocked"
          }
          meta="channel readiness + Razorpay + legal + payment write gate"
          tone={fullPaymentReady ? "green" : paymentReady ? "orange" : "red"}
        />
        <AdminMetric
          label="Refunds"
          value={refundReady ? "Ready" : "Blocked"}
          meta="refund write gate + Razorpay configuration"
          tone={refundReady ? "green" : "orange"}
        />
        <AdminMetric
          label="Admin Staff"
          value={staffCount.toString()}
          meta="non-customer accounts"
          tone="blue"
        />
      </div>

      <div className="admin-report-bottom">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Configuration Readiness</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Area</th><th>Status</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {configRows.map(([area, status, detail]) => (
                <tr key={area}>
                  <td>{area}</td>
                  <td>
                    <StatusPill
                      tone={
                        status === "Ready" || status === "Configured"
                          ? "green"
                          : "orange"
                      }
                    >
                      {status}
                    </StatusPill>
                  </td>
                  <td>{detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Write Gates</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Feature</th><th>State</th></tr>
            </thead>
            <tbody>
              {gateRows.map(([feature, state]) => (
                <tr key={feature}>
                  <td>{feature}</td>
                  <td>
                    <StatusPill tone={state === "Enabled" ? "green" : "gray"}>
                      {state}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-card-body">
            <p>
              Environment-backed settings must be changed in the deployment
              environment, not inside the application database.
            </p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
