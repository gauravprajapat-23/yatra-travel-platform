import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { requireAdminSession } from "@/lib/auth/session";
import { safeCsvCell } from "@/lib/admin/csv";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "report.read")) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(request.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const fromDate = parseIstStart(from);
  const toDate = parseIstEnd(to);

  if ((from && !fromDate) || (to && !toDate)) {
    return NextResponse.json(
      { error: "Invalid date range." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (fromDate && toDate && fromDate > toDate) {
    return NextResponse.json(
      { error: "Report start date must be before the end date." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const createdRange =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const db = getDb();
  const now = new Date();

  const [
    carCount,
    packageCount,
    leadCount,
    convertedLeadCount,
    capturedGroups,
    refundGroups,
    activeVehicles,
    assignedTrips,
    packageGroups,
    routeBookings,
    openMaintenanceCount,
    expiredComplianceCount,
    expiringComplianceCount,
    maintenanceCostGroups,
    promotionGroups,
    upcomingDepartures,
    openCrmFollowUps,
    overdueCrmFollowUps,
    crmInteractionsInPeriod,
  ] = await Promise.all([
    db.carBooking.count({
      where: createdRange ? { createdAt: createdRange } : undefined,
    }),
    db.packageBooking.count({
      where: createdRange ? { createdAt: createdRange } : undefined,
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
      take: 50,
    }),
    db.carBooking.findMany({
      where: createdRange ? { createdAt: createdRange } : undefined,
      select: {
        originText: true,
        destinationText: true,
        currency: true,
        totalMinor: true,
      },
      take: 10000,
    }),
    db.vehicleMaintenanceRecord.count({
      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
    }),
    db.vehicleComplianceDocument.count({
      where: {
        blocksDispatch: true,
        expiresAt: { not: null, lte: now },
        vehicle: { status: { not: "RETIRED" } },
      },
    }),
    db.vehicleComplianceDocument.count({
      where: {
        blocksDispatch: true,
        expiresAt: {
          gt: now,
          lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        vehicle: { status: { not: "RETIRED" } },
      },
    }),
    db.vehicleMaintenanceRecord.groupBy({
      by: ["currency"],
      where: {
        status: "COMPLETED",
        costMinor: { not: null },
        ...(createdRange ? { completedAt: createdRange } : {}),
      },
      _sum: { costMinor: true },
    }),
    db.promotionRedemption.groupBy({
      by: ["promotionId", "currency"],
      where: createdRange ? { redeemedAt: createdRange } : undefined,
      _count: { _all: true },
      _sum: { discountMinor: true },
      orderBy: { _count: { promotionId: "desc" } },
      take: 100,
    }),
    db.packageDeparture.findMany({
      where: {
        startsAt: { gte: now },
        status: { in: ["OPEN", "SOLD_OUT"] },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        id: true,
        startsAt: true,
        status: true,
        capacityTravellers: true,
        reservedTravellers: true,
        package: { select: { title: true } },
      },
    }),
    db.crmFollowUpTask.count({
      where: { status: "OPEN" },
    }),
    db.crmFollowUpTask.count({
      where: {
        status: "OPEN",
        dueAt: { lt: now },
      },
    }),
    db.crmInteraction.count({
      where: createdRange ? { occurredAt: createdRange } : undefined,
    }),
  ]);

  const packageIds = [...new Set(packageGroups.map((group) => group.packageId))];
  const packageNames = packageIds.length
    ? await db.tourPackage.findMany({
        where: { id: { in: packageIds } },
        select: { id: true, title: true },
      })
    : [];
  const packageNameById = new Map(
    packageNames.map((item) => [item.id, item.title]),
  );

  const promotionIds = [
    ...new Set(promotionGroups.map((group) => group.promotionId)),
  ];
  const promotionNames = promotionIds.length
    ? await db.promotion.findMany({
        where: { id: { in: promotionIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const promotionNameById = new Map(
    promotionNames.map((item) => [
      item.id,
      `${item.code} · ${item.name}`,
    ]),
  );

  const captured = new Map(
    capturedGroups.map((group) => [
      group.currency,
      group._sum.amountPaidMinor ?? 0n,
    ]),
  );
  const refunded = new Map(
    refundGroups.map((group) => [
      group.currency,
      group._sum.amountMinor ?? 0n,
    ]),
  );
  const currencies = new Set([...captured.keys(), ...refunded.keys()]);

  const routeMap = new Map<
    string,
    {
      bookings: number;
      totals: Map<string, bigint>;
    }
  >();

  for (const booking of routeBookings) {
    const route = `${booking.originText} → ${booking.destinationText}`;
    const current = routeMap.get(route) ?? {
      bookings: 0,
      totals: new Map<string, bigint>(),
    };

    current.bookings += 1;
    current.totals.set(
      booking.currency,
      (current.totals.get(booking.currency) ?? 0n) + booking.totalMinor,
    );
    routeMap.set(route, current);
  }

  const topRoutes = [...routeMap.entries()]
    .sort(([, a], [, b]) => b.bookings - a.bookings)
    .slice(0, 50);

  const rows: Array<Array<string | number | bigint>> = [
    ["Section", "Metric", "Dimension", "Currency", "Value"],
    ["Summary", "Car bookings", "", "", carCount],
    ["Summary", "Package bookings", "", "", packageCount],
    ["Summary", "Total bookings", "", "", carCount + packageCount],
    ["Summary", "Leads", "", "", leadCount],
    ["Summary", "Qualified / closed leads", "", "", convertedLeadCount],
    ["Summary", "Active vehicles", "", "", activeVehicles],
    ["Summary", "Vehicles currently assigned", "", "", assignedTrips.length],
    ["Fleet", "Open maintenance", "", "", openMaintenanceCount],
    ["Fleet", "Expired dispatch-blocking documents", "", "", expiredComplianceCount],
    ["Fleet", "Dispatch-blocking documents expiring within 30 days", "", "", expiringComplianceCount],
    ["CRM", "Open follow-ups", "", "", openCrmFollowUps],
    ["CRM", "Overdue follow-ups", "", "", overdueCrmFollowUps],
    ["CRM", "Interactions in selected period", "", "", crmInteractionsInPeriod],
    ["Packages", "Upcoming OPEN / SOLD_OUT departures", "", "", upcomingDepartures.length],
  ];

  for (const currency of [...currencies].sort()) {
    const capturedMinor = captured.get(currency) ?? 0n;
    const refundedMinor = refunded.get(currency) ?? 0n;

    rows.push(
      ["Financial", "Captured minor", "", currency, capturedMinor],
      ["Financial", "Processed refund minor", "", currency, refundedMinor],
      ["Financial", "Net captured minor", "", currency, capturedMinor - refundedMinor],
    );
  }

  for (const group of maintenanceCostGroups) {
    rows.push([
      "Fleet",
      "Completed maintenance cost minor",
      "",
      group.currency,
      group._sum.costMinor ?? 0n,
    ]);
  }

  for (const group of promotionGroups) {
    rows.push(
      [
        "Promotions",
        "Redemptions",
        promotionNameById.get(group.promotionId) ?? group.promotionId,
        group.currency,
        group._count._all,
      ],
      [
        "Promotions",
        "Customer savings minor",
        promotionNameById.get(group.promotionId) ?? group.promotionId,
        group.currency,
        group._sum.discountMinor ?? 0n,
      ],
    );
  }

  for (const departure of upcomingDepartures) {
    const remaining =
      departure.capacityTravellers === null
        ? "Unlimited"
        : Math.max(
            0,
            departure.capacityTravellers - departure.reservedTravellers,
          );

    rows.push(
      [
        "Departures",
        "Reserved travellers",
        `${departure.package.title} · ${departure.id} · ${departure.startsAt.toISOString()} · ${departure.status}`,
        "",
        departure.reservedTravellers,
      ],
      [
        "Departures",
        "Remaining capacity",
        `${departure.package.title} · ${departure.id} · ${departure.startsAt.toISOString()} · ${departure.status}`,
        "",
        remaining,
      ],
    );
  }

  for (const group of packageGroups) {
    const title = packageNameById.get(group.packageId) ?? group.packageId;
    rows.push(
      [
        "Packages",
        "Bookings",
        title,
        group.currency,
        group._count._all,
      ],
      [
        "Packages",
        "Booked value minor",
        title,
        group.currency,
        group._sum.totalMinor ?? 0n,
      ],
    );
  }

  for (const [route, data] of topRoutes) {
    rows.push(["Routes", "Bookings", route, "", data.bookings]);

    for (const [currency, amount] of [...data.totals.entries()].sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      rows.push([
        "Routes",
        "Booked value minor",
        route,
        currency,
        amount,
      ]);
    }
  }

  const csv = rows
    .map((row) => row.map(safeCsvCell).join(","))
    .join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  const rangeLabel =
    from || to ? `${from || "start"}-to-${to || "end"}` : "all-time";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        `attachment; filename="yatra-management-report-${rangeLabel}-${stamp}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
