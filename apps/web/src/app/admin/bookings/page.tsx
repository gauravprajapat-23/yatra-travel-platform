import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {
  bookingStatuses,
  type BookingStatus,
} from "@yatra/domain/booking/status-machine";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function parseDateStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T23:59:59.999+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function money(minor: bigint, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "green";
  if (
    ["PENDING_PAYMENT", "PENDING_REVIEW", "REFUND_PENDING"].includes(status)
  ) {
    return "orange";
  }
  if (["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(status)) {
    return "red";
  }
  if (["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(status)) return "blue";
  return "gray";
}

function isBookingStatus(value: string): value is BookingStatus {
  return (bookingStatuses as readonly string[]).includes(value);
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    assignment?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isBookingStatus(String(params.status ?? ""))
    ? String(params.status) as BookingStatus
    : null;
  const type =
    params.type === "CAR" || params.type === "PACKAGE"
      ? params.type
      : "ALL";
  const assignment =
    params.assignment === "ASSIGNED" || params.assignment === "UNASSIGNED"
      ? params.assignment
      : "ALL";
  const from = String(params.from ?? "").trim();
  const to = String(params.to ?? "").trim();
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  const travelRange =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const carWhere: Prisma.CarBookingWhereInput = {
    ...(status ? { status } : {}),
    ...(travelRange ? { startsAt: travelRange } : {}),
    ...(assignment === "ASSIGNED"
      ? { selectedVehicleId: { not: null }, assignedDriverId: { not: null } }
      : assignment === "UNASSIGNED"
        ? { OR: [{ selectedVehicleId: null }, { assignedDriverId: null }] }
        : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { guestName: { contains: q, mode: "insensitive" } },
            { guestEmail: { contains: q, mode: "insensitive" } },
            { originText: { contains: q, mode: "insensitive" } },
            { destinationText: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const packageWhere: Prisma.PackageBookingWhereInput = {
    ...(status ? { status } : {}),
    ...(travelRange ? { travelStartAt: travelRange } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { guestName: { contains: q, mode: "insensitive" } },
            { guestEmail: { contains: q, mode: "insensitive" } },
            {
              package: {
                title: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const fetchLimit = page * PAGE_SIZE;

  const [cars, packages, carCount, packageCount] = await Promise.all([
    type === "PACKAGE"
      ? Promise.resolve([])
      : db.carBooking.findMany({
          where: carWhere,
          orderBy: { createdAt: "desc" },
          take: fetchLimit,
          select: {
            reference: true,
            guestName: true,
            originText: true,
            destinationText: true,
            startsAt: true,
            currency: true,
            totalMinor: true,
            status: true,
            vehicleClass: { select: { name: true } },
            createdAt: true,
          },
        }),
    type === "CAR"
      ? Promise.resolve([])
      : db.packageBooking.findMany({
          where: packageWhere,
          orderBy: { createdAt: "desc" },
          take: fetchLimit,
          select: {
            reference: true,
            guestName: true,
            travelStartAt: true,
            currency: true,
            totalMinor: true,
            status: true,
            package: { select: { title: true } },
            createdAt: true,
          },
        }),
    type === "PACKAGE"
      ? Promise.resolve(0)
      : db.carBooking.count({ where: carWhere }),
    type === "CAR"
      ? Promise.resolve(0)
      : db.packageBooking.count({ where: packageWhere }),
  ]);

  const combined = [
    ...cars.map((booking) => ({
      type: "CAR" as const,
      reference: booking.reference,
      customer: booking.guestName,
      summary: `${booking.originText} → ${booking.destinationText}`,
      date: booking.startsAt,
      vehicle: booking.vehicleClass.name,
      amount: money(booking.totalMinor, booking.currency),
      status: booking.status,
      createdAt: booking.createdAt,
    })),
    ...packages.map((booking) => ({
      type: "PACKAGE" as const,
      reference: booking.reference,
      customer: booking.guestName,
      summary: booking.package.title,
      date: booking.travelStartAt,
      vehicle: "Tour package",
      amount: money(booking.totalMinor, booking.currency),
      status: booking.status,
      createdAt: booking.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const matchingCount = carCount + packageCount;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageRows = combined.slice(offset, offset + PAGE_SIZE);

  const confirmed = pageRows.filter(
    (booking) => booking.status === "CONFIRMED",
  ).length;
  const pending = pageRows.filter((booking) =>
    ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(booking.status),
  ).length;
  const completed = pageRows.filter(
    (booking) => booking.status === "COMPLETED",
  ).length;

  const rows = pageRows.map((booking) => [
    <Link key={booking.reference} href={`/admin/bookings/${booking.reference}`}>
      {booking.reference}
    </Link>,
    booking.customer ?? "Account customer",
    booking.summary,
    booking.date.toLocaleDateString("en-IN"),
    booking.vehicle,
    booking.amount,
    <StatusPill key={`${booking.reference}-status`} tone={tone(booking.status)}>
      {booking.status.replaceAll("_", " ")}
    </StatusPill>,
    <Link
      key={`${booking.reference}-view`}
      href={`/admin/bookings/${booking.reference}`}
    >
      View
    </Link>,
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (type !== "ALL") next.set("type", type);
    if (assignment !== "ALL") next.set("assignment", assignment);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/bookings?${query}` : "/admin/bookings";
  }

  const firstShown = matchingCount === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + pageRows.length, matchingCount);

  return (
    <AdminTablePage
      active="Bookings"
      title="Bookings"
      subtitle="Live car and package bookings from Neon, newest first."
      metrics={[
        {
          label: "Matching Bookings",
          value: matchingCount.toString(),
          meta: "current filters",
          tone: "orange",
        },
        {
          label: "Confirmed",
          value: confirmed.toString(),
          meta: "current page",
          tone: "green",
        },
        {
          label: "Pending",
          value: pending.toString(),
          meta: "current page",
          tone: "orange",
        },
        {
          label: "Completed",
          value: completed.toString(),
          meta: "current page",
          tone: "blue",
        },
      ]}
      filters={[
        type === "ALL" ? "All booking types" : type.replaceAll("_", " "),
        status ? status.replaceAll("_", " ") : "All statuses",
        assignment === "ALL" ? "All assignments" : assignment.replaceAll("_", " "),
        from || to ? `${from || "…"} → ${to || "…"}` : "All travel dates",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <label>
            <span>Search</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Reference, customer, email or route"
            />
          </label>

          <label>
            <span>Type</span>
            <select name="type" defaultValue={type}>
              <option value="ALL">All types</option>
              <option value="CAR">Car</option>
              <option value="PACKAGE">Package</option>
            </select>
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {bookingStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Assignment</span>
            <select name="assignment" defaultValue={assignment}>
              <option value="ALL">All assignments</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="UNASSIGNED">Needs assignment</option>
            </select>
          </label>

          <label>
            <span>Travel from</span>
            <input type="date" name="from" defaultValue={from} />
          </label>

          <label>
            <span>Travel to</span>
            <input type="date" name="to" defaultValue={to} />
          </label>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          <Link
            className="admin-secondary-button"
            href={`/api/admin/bookings/export?${new URLSearchParams({
              ...(q ? { q } : {}),
              ...(status ? { status } : {}),
              ...(type !== "ALL" ? { type } : {}),
              ...(assignment !== "ALL" ? { assignment } : {}),
              ...(from ? { from } : {}),
              ...(to ? { to } : {}),
            }).toString()}`}
          >
            Export CSV
          </Link>

          {(q || status || type !== "ALL" || assignment !== "ALL" || from || to) ? (
            <Link className="admin-secondary-button" href="/admin/bookings">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Booking ID",
        "Customer",
        "Route / Package",
        "Date",
        "Vehicle / Type",
        "Amount",
        "Status",
        "Actions",
      ]}
      rows={rows}
      footer={
        <>
          <span>
            Showing {firstShown}–{lastShown} of {matchingCount}
          </span>
          <div className="admin-table-pager">
            {safePage > 1 ? (
              <Link
                className="admin-secondary-button"
                href={pageHref(safePage - 1)}
              >
                ← Previous
              </Link>
            ) : null}
            <small>
              Page {safePage} of {totalPages}
            </small>
            {safePage < totalPages ? (
              <Link
                className="admin-secondary-button"
                href={pageHref(safePage + 1)}
              >
                Next →
              </Link>
            ) : null}
          </div>
        </>
      }
    />
  );
}
