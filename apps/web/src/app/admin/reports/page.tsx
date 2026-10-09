import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate } from "@/lib/admin/datetime";

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
  const reversedRange = Boolean(
    fromDate && toDate && fromDate > toDate,
  );
  const fromError =
    from && !fromDate
      ? "Enter a valid start date."
      : reversedRange
        ? "Start date must be on or before the end date."
        : undefined;
  const toError =
    to && !toDate
      ? "Enter a valid end date."
      : reversedRange
        ? "End date must be on or after the start date."
        : undefined;
  const hasRangeError = Boolean(fromError || toError);
  const effectiveFromDate = hasRangeError ? null : fromDate;
  const effectiveToDate = hasRangeError ? null : toDate;

  const db = getDb();
  const now = new Date();
  const trendEnd = effectiveToDate ?? now;
  const trendStartFloor = new Date(trendEnd.getTime() - 13 * 24 * 60 * 60 * 1000);
  const trendStart =
    effectiveFromDate && effectiveFromDate > trendStartFloor
      ? effectiveFromDate
      : trendStartFloor;
  const trendRange = { gte: trendStart, lte: trendEnd };

  const createdRange =
    effectiveFromDate || effectiveToDate
      ? {
          ...(effectiveFromDate ? { gte: effectiveFromDate } : {}),
          ...(effectiveToDate ? { lte: effectiveToDate } : {}),
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
    trendCars,
    trendPackages,
    trendPayments,
    trendRefunds,
    routeBookings,
    promotionGroups,
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
    db.carBooking.findMany({
      where: { createdAt: trendRange },
      select: { createdAt: true },
    }),
    db.packageBooking.findMany({
      where: { createdAt: trendRange },
      select: { createdAt: true },
    }),
    db.paymentIntent.findMany({
      where: {
        status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
        capturedAt: trendRange,
      },
      select: {
        capturedAt: true,
        currency: true,
        amountPaidMinor: true,
      },
    }),
    db.refund.findMany({
      where: {
        status: "PROCESSED",
        processedAt: trendRange,
      },
      select: {
        processedAt: true,
        currency: true,
        amountMinor: true,
      },
    }),
    db.carBooking.findMany({
      where: createdRange ? { createdAt: createdRange } : undefined,
      select: {
        originText: true,
        destinationText: true,
        currency: true,
        totalMinor: true,
      },
      take: 5000,
    }),
    db.promotionRedemption.groupBy({
      by: ["promotionId", "currency"],
      where: createdRange ? { redeemedAt: createdRange } : undefined,
      _count: { _all: true },
      _sum: { discountMinor: true },
      orderBy: { _count: { promotionId: "desc" } },
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

  const promotionIds = [
    ...new Set(promotionGroups.map((group) => group.promotionId)),
  ];
  const promotionNames = promotionIds.length
    ? await db.promotion.findMany({
        where: { id: { in: promotionIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const promotionById = new Map(
    promotionNames.map((item) => [item.id, item]),
  );

  const promotionDiscountByCurrency = new Map<string, bigint>();
  let promotionRedemptionCount = 0;
  for (const group of promotionGroups) {
    promotionRedemptionCount += group._count._all;
    promotionDiscountByCurrency.set(
      group.currency,
      (promotionDiscountByCurrency.get(group.currency) ?? 0n) +
        (group._sum.discountMinor ?? 0n),
    );
  }

  const totalBookings = carCount + packageCount;
  const conversionRate =
    leadCount > 0 ? Math.round((convertedLeadCount / leadCount) * 100) : 0;
  const fleetUtilization =
    activeVehicles > 0
      ? Math.round((assignedTrips.length / activeVehicles) * 100)
      : 0;

  const periodLabel = hasRangeError
    ? "Invalid date range · showing all-time activity until corrected"
    : from || to
      ? `${from || "…"} → ${to || "…"} (IST)`
      : "All-time activity";

  const exportParams = new URLSearchParams();
  if (!hasRangeError && from) exportParams.set("from", from);
  if (!hasRangeError && to) exportParams.set("to", to);
  const exportQuery = exportParams.toString();
  const exportHref = exportQuery
    ? `/api/admin/reports/export?${exportQuery}`
    : "/api/admin/reports/export";

  const dayKey = (value: Date) =>
    value.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const trendBuckets = new Map<string, {
    date: string;
    bookings: number;
    captured: Map<string, bigint>;
    refunded: Map<string, bigint>;
  }>();

  for (
    let cursor = new Date(trendStart);
    cursor <= trendEnd;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const key = dayKey(cursor);
    trendBuckets.set(key, {
      date: key,
      bookings: 0,
      captured: new Map(),
      refunded: new Map(),
    });
  }

  for (const booking of [...trendCars, ...trendPackages]) {
    const bucket = trendBuckets.get(dayKey(booking.createdAt));
    if (bucket) bucket.bookings += 1;
  }

  for (const payment of trendPayments) {
    if (!payment.capturedAt) continue;
    const bucket = trendBuckets.get(dayKey(payment.capturedAt));
    if (!bucket) continue;
    bucket.captured.set(
      payment.currency,
      (bucket.captured.get(payment.currency) ?? 0n) + payment.amountPaidMinor,
    );
  }

  for (const refund of trendRefunds) {
    if (!refund.processedAt) continue;
    const bucket = trendBuckets.get(dayKey(refund.processedAt));
    if (!bucket) continue;
    bucket.refunded.set(
      refund.currency,
      (bucket.refunded.get(refund.currency) ?? 0n) + refund.amountMinor,
    );
  }

  const trends = [...trendBuckets.values()];
  const maxBookings = Math.max(1, ...trends.map((item) => item.bookings));

  const routeMap = new Map<string, {
    route: string;
    bookings: number;
    values: Map<string, bigint>;
  }>();

  for (const booking of routeBookings) {
    const route = `${booking.originText} → ${booking.destinationText}`;
    const current = routeMap.get(route) ?? {
      route,
      bookings: 0,
      values: new Map<string, bigint>(),
    };
    current.bookings += 1;
    current.values.set(
      booking.currency,
      (current.values.get(booking.currency) ?? 0n) + booking.totalMinor,
    );
    routeMap.set(route, current);
  }

  const topRoutes = [...routeMap.values()]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);

  return (
    <AdminShell
      active="Reports"
      title="Reports"
      subtitle="Live operational and financial summary from Neon."
      actions={
        <Link className="admin-primary-button" href={exportHref}>
          Export CSV
        </Link>
      }
    >
      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminFormGrid columns={2}>
            <AdminField
              label="From date (IST)"
              htmlFor="reportFrom"
              error={fromError}
            >
              <input
                id="reportFrom"
                type="date"
                name="from"
                defaultValue={from}
              />
            </AdminField>

            <AdminField
              label="To date (IST)"
              htmlFor="reportTo"
              error={toError}
            >
              <input
                id="reportTo"
                type="date"
                name="to"
                defaultValue={to}
              />
            </AdminField>
          </AdminFormGrid>

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
        <AdminMetric
          label="Promotion Savings"
          value={formatCurrencyMap(promotionDiscountByCurrency)}
          meta={`${promotionRedemptionCount} committed redemptions`}
          tone="blue"
        />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>14-Day Booking / Revenue Trend</h2>
          <small>Daily activity in IST ending {formatIstDate(trendEnd)}</small>
        </div>
        <div className="admin-report-trend">
          {trends.map((item) => (
            <div className="admin-report-trend__row" key={item.date}>
              <strong>{new Date(`${item.date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</strong>
              <div className="admin-report-trend__bar-track" aria-label={`${item.bookings} bookings`}>
                <span style={{ width: `${Math.max(4, Math.round((item.bookings / maxBookings) * 100))}%` }} />
              </div>
              <span>{item.bookings} bookings</span>
              <span>Captured {formatCurrencyMap(item.captured)}</span>
              <span>Refunded {formatCurrencyMap(item.refunded)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-report-bottom">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Top Car Routes</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Bookings</th>
                <th>Booked Value</th>
              </tr>
            </thead>
            <tbody>
              {topRoutes.length === 0 ? (
                <tr><td colSpan={3}>No car bookings in this period.</td></tr>
              ) : topRoutes.map((item) => (
                <tr key={item.route}>
                  <td>{item.route}</td>
                  <td>{item.bookings}</td>
                  <td>{formatCurrencyMap(item.values)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>


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
            <h2>Top Promotions</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Promotion</th>
                  <th>Currency</th>
                  <th>Redemptions</th>
                  <th>Customer Savings</th>
                </tr>
              </thead>
              <tbody>
                {promotionGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No promotion redemptions in this period.</td>
                  </tr>
                ) : (
                  promotionGroups.map((group) => {
                    const promotion = promotionById.get(group.promotionId);
                    return (
                      <tr key={`${group.promotionId}-${group.currency}`}>
                        <td>
                          {promotion
                            ? `${promotion.code} · ${promotion.name}`
                            : group.promotionId}
                        </td>
                        <td>{group.currency}</td>
                        <td>{group._count._all}</td>
                        <td>
                          {money(
                            group._sum.discountMinor ?? 0n,
                            group.currency,
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
