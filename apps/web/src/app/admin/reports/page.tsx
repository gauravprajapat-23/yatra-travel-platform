import Link from "next/link";
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

function parseIstStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseIstEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T23:59:59.999+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCurrencyMap(values: ReadonlyMap<string, bigint>): string {
  const rendered = [...values.entries()]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => money(amount, currency));

  return rendered.length > 0 ? rendered.join(" · ") : "—";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "report.read")) redirect("/admin");

  const params = await searchParams;
  const from = String(params.from ?? "").trim();
  const to = String(params.to ?? "").trim();
  const fromDate = parseIstStart(from);
  const toDate = parseIstEnd(to);

  if (fromDate && toDate && fromDate > toDate) {
    throw new Error("Report start date must be before the end date.");
  }

  const db = getDb();
  const now = new Date();

  const createdRange =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const [
    carCount,
    packageCount,
    capturedGroups,
    refundGroups,
    leadCount,
    convertedLeadCount,
    activeVehicles,
    assignedTrips,
    packageGroups,
  ] = await Promise.all([
    db.carBooking.count({
      where: createdRange ? { createdAt: createdRange } : undefined,
    }),
    db.packageBooking.count({
      where: createdRange ? { createdAt: createdRange } : undefined,
    }),
    db.paymentIntent.groupBy({
      by: ["currency"],
      where: {
        status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
        ...(createdRange ? { capturedAt: createdRange } : {}),
      },
      _sum: { amountPaidMinor: true },
    }),
    db.refund.groupBy({
      by: ["currency"],
      where: {
        status: "PROCESSED",
        ...(createdRange ? { processedAt: createdRange } : {}),
      },
      _sum: { amountMinor: true },
    }),
    db.lead.count({
      where: createdRange ? { createdAt: createdRange } : undefined,
    }),
    db.lead.count({
      where: {
        status: { in: ["QUALIFIED", "CLOSED"] },
        ...(createdRange ? { createdAt: createdRange } : {}),
      },
    }),
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
      by: ["packageId", "currency"],
      where: createdRange ? { createdAt: createdRange } : undefined,
      _count: { _all: true },
      _sum: { totalMinor: true },
      orderBy: { _count: { packageId: "desc" } },
      take: 10,
    }),
  ]);

  const capturedByCurrency = new Map<string, bigint>();
  for (const group of capturedGroups) {
    capturedByCurrency.set(
      group.currency,
      group._sum.amountPaidMinor ?? 0n,
    );
  }

  const refundedByCurrency = new Map<string, bigint>();
  for (const group of refundGroups) {
    refundedByCurrency.set(
      group.currency,
      group._sum.amountMinor ?? 0n,
    );
  }

  const netCapturedByCurrency = new Map<string, bigint>();
  const currencies = new Set([
    ...capturedByCurrency.keys(),
    ...refundedByCurrency.keys(),
  ]);
  for (const currency of currencies) {
    netCapturedByCurrency.set(
      currency,
      (capturedByCurrency.get(currency) ?? 0n) -
        (refundedByCurrency.get(currency) ?? 0n),
    );
  }

  const packageIds = [
    ...new Set(packageGroups.map((group) => group.packageId)),
  ];
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
    activeVehicles > 0
      ? Math.round((assignedTrips.length / activeVehicles) * 100)
      : 0;

  const periodLabel =
    from || to
      ? `${from || "…"} → ${to || "…"} (IST)`
      : "All-time activity";

  return (
    <AdminShell
      active="Reports"
      title="Reports"
      subtitle="Live operational and financial summary from Neon."
    >
      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <label>
            <span>From date (IST)</span>
            <input type="date" name="from" defaultValue={from} />
          </label>

          <label>
            <span>To date (IST)</span>
            <input type="date" name="to" defaultValue={to} />
          </label>

          <button className="admin-primary-button" type="submit">
            Apply Range
          </button>

          {(from || to) ? (
            <Link className="admin-secondary-button" href="/admin/reports">
              Reset
            </Link>
          ) : null}
        </form>
        <p>{periodLabel}</p>
      </section>

      <div className="admin-metric-grid">
        <AdminMetric
          label="Total Bookings"
          value={totalBookings.toString()}
          meta="car + package in selected period"
          tone="blue"
        />
        <AdminMetric
          label="Net Captured"
          value={formatCurrencyMap(netCapturedByCurrency)}
          meta="gross captures minus processed refunds"
          tone="orange"
        />
        <AdminMetric
          label="Qualified / Closed Leads"
          value={convertedLeadCount.toString()}
          meta={`${conversionRate}% of leads in selected period`}
          tone="green"
        />
        <AdminMetric
          label="Current Fleet Utilization"
          value={`${fleetUtilization}%`}
          meta={`${assignedTrips.length} of ${activeVehicles} active vehicles now`}
          tone="green"
        />
      </div>

      <div className="admin-report-bottom">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Top Packages by Bookings</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Currency</th>
                <th>Bookings</th>
                <th>Booked Value</th>
              </tr>
            </thead>
            <tbody>
              {packageGroups.length === 0 ? (
                <tr>
                  <td colSpan={4}>No package bookings in this period.</td>
                </tr>
              ) : (
                packageGroups.map((group) => (
                  <tr key={`${group.packageId}-${group.currency}`}>
                    <td>{nameById.get(group.packageId) ?? group.packageId}</td>
                    <td>{group.currency}</td>
                    <td>{group._count._all}</td>
                    <td>
                      {money(
                        group._sum.totalMinor ?? 0n,
                        group.currency,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Operational Snapshot</h2>
          </div>
          <div className="admin-card-body">
            <p>
              Car bookings <strong>{carCount}</strong>
            </p>
            <p>
              Package bookings <strong>{packageCount}</strong>
            </p>
            <p>
              Leads <strong>{leadCount}</strong>
            </p>
            <p>
              Gross captured{" "}
              <strong>{formatCurrencyMap(capturedByCurrency)}</strong>
            </p>
            <p>
              Processed refunds{" "}
              <strong>{formatCurrencyMap(refundedByCurrency)}</strong>
            </p>
            <p>
              Active fleet <strong>{activeVehicles}</strong>
            </p>
            <p>
              Vehicles currently assigned <strong>{assignedTrips.length}</strong>
            </p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
