import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export default async function ReportsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "report.read")) redirect("/admin");

  const db = getDb();
  const now = new Date();

  const [
    carCount,
    packageCount,
    captured,
    leadCount,
    convertedLeadCount,
    activeVehicles,
    assignedTrips,
    packageGroups,
  ] = await Promise.all([
    db.carBooking.count(),
    db.packageBooking.count(),
    db.paymentIntent.aggregate({
      where: { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _sum: { amountPaidMinor: true },
    }),
    db.lead.count(),
    db.lead.count({ where: { status: { in: ["QUALIFIED", "CLOSED"] } } }),
    db.vehicle.count({ where: { status: "ACTIVE" } }),
    db.carBooking.findMany({
      where: {
        selectedVehicleId: { not: null },
        status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      distinct: ["selectedVehicleId"],
      select: { selectedVehicleId: true },
    }),
    db.packageBooking.groupBy({
      by: ["packageId"],
      _count: { _all: true },
      _sum: { totalMinor: true },
      orderBy: { _count: { packageId: "desc" } },
      take: 5,
    }),
  ]);

  const packageIds = packageGroups.map((group) => group.packageId);
  const packageNames = packageIds.length
    ? await db.tourPackage.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, title: true },
      })
    : [];
  const nameById = new Map(packageNames.map((item) => [item.id, item.title]));

  const totalBookings = carCount + packageCount;
  const conversionRate =
    leadCount > 0 ? Math.round((convertedLeadCount / leadCount) * 100) : 0;
  const fleetUtilization =
    activeVehicles > 0 ? Math.round((assignedTrips.length / activeVehicles) * 100) : 0;

  return (
    <AdminShell
      active="Reports"
      title="Reports"
      subtitle="Live operational and financial summary from Neon."
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Total Bookings" value={totalBookings.toString()} meta="car + package" tone="blue"/>
        <AdminMetric label="Captured Revenue" value={money(captured._sum.amountPaidMinor ?? 0n)} meta="verified payment captures" tone="orange"/>
        <AdminMetric label="Qualified / Closed Leads" value={convertedLeadCount.toString()} meta={`${conversionRate}% of all leads`} tone="green"/>
        <AdminMetric label="Fleet Utilization" value={`${fleetUtilization}%`} meta={`${assignedTrips.length} of ${activeVehicles} active vehicles`} tone="green"/>
      </div>

      <div className="admin-report-bottom">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Top Packages by Bookings</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Package</th><th>Bookings</th><th>Booked Value</th></tr>
            </thead>
            <tbody>
              {packageGroups.length === 0 ? (
                <tr><td colSpan={3}>No package bookings yet.</td></tr>
              ) : packageGroups.map((group) => (
                <tr key={group.packageId}>
                  <td>{nameById.get(group.packageId) ?? group.packageId}</td>
                  <td>{group._count._all}</td>
                  <td>{money(group._sum.totalMinor ?? 0n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Operational Snapshot</h2>
          </div>
          <div className="admin-card-body">
            <p>Car bookings <strong>{carCount}</strong></p>
            <p>Package bookings <strong>{packageCount}</strong></p>
            <p>Total leads <strong>{leadCount}</strong></p>
            <p>Active fleet <strong>{activeVehicles}</strong></p>
            <p>Vehicles currently assigned <strong>{assignedTrips.length}</strong></p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
