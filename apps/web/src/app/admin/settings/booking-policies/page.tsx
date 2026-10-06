import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  if (status === "RETIRED") return "gray";
  return "gray";
}

export default async function BookingPoliciesPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const db = getDb();

  const [policies, total, active, drafts, retired] = await Promise.all([
    db.bookingPolicyVersion.findMany({
      orderBy: [{ code: "asc" }, { version: "desc" }],
      take: 200,
    }),
    db.bookingPolicyVersion.count(),
    db.bookingPolicyVersion.count({ where: { status: "ACTIVE" } }),
    db.bookingPolicyVersion.count({ where: { status: "DRAFT" } }),
    db.bookingPolicyVersion.count({ where: { status: "RETIRED" } }),
  ]);

  return (
    <AdminShell
      active="Settings"
      title="Booking Policies"
      subtitle="Versioned commercial/legal policy documents snapshotted into bookings."
      actions={
        <div>
          <Link className="admin-secondary-button" href="/admin/settings">
            ← Settings
          </Link>
          <Link className="admin-primary-button" href="/admin/settings/booking-policies/new">
            ＋ New Policy Version
          </Link>
        </div>
      }
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Versions" value={total.toString()} meta="all policy versions" tone="blue"/>
        <AdminMetric label="Active" value={active.toString()} meta="currently selectable" tone="green"/>
        <AdminMetric label="Drafts" value={drafts.toString()} meta="editable" tone="orange"/>
        <AdminMetric label="Retired" value={retired.toString()} meta="historical only" tone="blue"/>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Version</th>
                <th>Status</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Activated</th>
                <th>Retired</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={7}>No booking policy versions exist yet.</td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <Link href={`/admin/settings/booking-policies/${policy.id}`}>
                        {policy.code}
                      </Link>
                    </td>
                    <td>v{policy.version}</td>
                    <td>
                      <StatusPill tone={tone(policy.status)}>
                        {policy.status}
                      </StatusPill>
                    </td>
                    <td>{policy.effectiveFrom?.toLocaleString("en-IN") ?? "Immediate"}</td>
                    <td>{policy.effectiveTo?.toLocaleString("en-IN") ?? "No expiry"}</td>
                    <td>{policy.activatedAt?.toLocaleString("en-IN") ?? "—"}</td>
                    <td>{policy.retiredAt?.toLocaleString("en-IN") ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
