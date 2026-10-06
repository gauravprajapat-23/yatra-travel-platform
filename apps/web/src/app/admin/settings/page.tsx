import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

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

  const bookingWriteEnabled = process.env.BOOKING_WRITE_ENABLED === "true";
  const packageBookingWriteEnabled =
    process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true";
  const paymentWriteEnabled = process.env.PAYMENT_WRITE_ENABLED === "true";
  const refundWriteEnabled = process.env.REFUND_WRITE_ENABLED === "true";
  const mediaWriteEnabled = process.env.MEDIA_WRITE_ENABLED === "true";

  const legalReady = legalPages === 3;
  const carReady =
    bookingWriteEnabled &&
    carPolicies > 0 &&
    activePricingRules > 0 &&
    activeVehicles > 0;
  const packageReady =
    packageBookingWriteEnabled &&
    packagePolicies > 0;
  const paymentReady =
    paymentWriteEnabled &&
    razorpayConfigured &&
    legalReady &&
    (carReady || packageReady);

  const configRows = [
    ["Application URL", yesNo(appUrlConfigured), "NEXT_PUBLIC_APP_URL"],
    ["Razorpay", yesNo(razorpayConfigured), "Key ID + secret + webhook secret"],
    ["S3 Storage", yesNo(storageConfigured), "Bucket, endpoint, credentials, public base URL"],
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
    >
      <div className="admin-metric-grid">
        <AdminMetric
          label="Payment Readiness"
          value={paymentReady ? "Ready" : "Blocked"}
          meta="requires checkout + Razorpay + legal readiness"
          tone={paymentReady ? "green" : "red"}
        />
        <AdminMetric
          label="Car Booking"
          value={carReady ? "Ready" : "Blocked"}
          meta="writes + policy + pricing + fleet"
          tone={carReady ? "green" : "orange"}
        />
        <AdminMetric
          label="Package Booking"
          value={packageReady ? "Ready" : "Blocked"}
          meta="writes + active policy"
          tone={packageReady ? "green" : "orange"}
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
