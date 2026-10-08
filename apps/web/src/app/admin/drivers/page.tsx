import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate } from "@/lib/admin/datetime";
import { driverStatuses } from "@/modules/fleet/fleet-management-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "ON_LEAVE") return "orange";
  if (status === "SUSPENDED" || status === "INACTIVE") return "red";
  return "gray";
}

type DriverStatusValue = (typeof driverStatuses)[number];

function isDriverStatus(value: string): value is DriverStatusValue {
  return (driverStatuses as readonly string[]).includes(value);
}

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "driver.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isDriverStatus(String(params.status ?? ""))
    ? (String(params.status) as DriverStatusValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const baseWhere: Prisma.DriverWhereInput = q
    ? {
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { phoneLast4: { contains: q, mode: "insensitive" } },
          {
            qualifications: {
              some: {
                vehicleClass: {
                  name: { contains: q, mode: "insensitive" },
                },
              },
            },
          },
        ],
      }
    : {};

  const where: Prisma.DriverWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.driver.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [drivers, active, onLeave, docsDue] = await Promise.all([
    db.driver.findMany({
      where,
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
      include: {
        qualifications: {
          include: { vehicleClass: { select: { name: true } } },
        },
      },
      skip,
      take: PAGE_SIZE,
    }),
    db.driver.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    db.driver.count({ where: { ...baseWhere, status: "ON_LEAVE" } }),
    db.driver.count({
      where: {
        ...baseWhere,
        licenseExpiry: {
          not: null,
          lte: soon,
        },
      },
    }),
  ]);

  const rows = drivers.map((driver) => [
    <Link key={driver.id} href={`/admin/drivers/${driver.id}`}>
      {driver.displayName}
    </Link>,
    driver.phoneLast4 ? `•••• ${driver.phoneLast4}` : "Protected",
    driver.qualifications.map((item) => item.vehicleClass.name).join(", ") ||
      "Unqualified",
    driver.licenseExpiry ? formatIstDate(driver.licenseExpiry) : "Not recorded",
    <StatusPill key={driver.id} tone={tone(driver.status)}>
      {driver.status.replaceAll("_", " ")}
    </StatusPill>,
    driver.licenseExpiry && driver.licenseExpiry <= soon ? "Due soon" : "OK",
    driver.internalNotes ?? "—",
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/drivers?${query}` : "/admin/drivers";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + drivers.length, total);

  return (
    <AdminTablePage
      active="Drivers & Staff"
      title="Drivers"
      subtitle="Live driver roster with qualifications and document status."
      actions={
        hasPermission(session.roles, "driver.write") ? (
          <Link className="admin-primary-button" href="/admin/drivers/new">
            ＋ New Driver
          </Link>
        ) : null
      }
      metrics={[
        {
          label: "Matching Drivers",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Active Drivers",
          value: active.toString(),
          meta: "current search",
          tone: "green",
        },
        {
          label: "On Leave",
          value: onLeave.toString(),
          meta: "current search",
          tone: "orange",
        },
        {
          label: "Documents Due",
          value: docsDue.toString(),
          meta: "license due within 30 days",
          tone: "red",
        },
      ]}
      filters={[
        status ? status.replaceAll("_", " ") : "All statuses",
        q ? `Search: ${q}` : "All drivers",
      ]}
      toolbar={
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Search" htmlFor="driverSearch">
            <input
              id="driverSearch"
              name="q"
              defaultValue={q}
              placeholder="Driver name, phone last-4 or vehicle class"
            />
          </AdminField>

          <AdminField label="Status" htmlFor="driverStatus">
            <select
              id="driverStatus"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">All statuses</option>
              {driverStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status) ? (
            <Link className="admin-secondary-button" href="/admin/drivers">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Driver",
        "Contact",
        "Qualified Classes",
        "License Expiry",
        "Status",
        "Documents",
        "Notes",
      ]}
      emptyTitle={
        q || status ? "No drivers match these filters" : "No drivers yet"
      }
      emptyMessage={
        q || status
          ? "Clear or change the current driver filters to see more records."
          : "Add the first driver profile before assigning bookings and vehicle classes."
      }
      emptyAction={
        !q &&
        !status &&
        hasPermission(session.roles, "driver.write") ? (
          <Link className="admin-primary-button" href="/admin/drivers/new">
            ＋ Add First Driver
          </Link>
        ) : null
      }
      rows={rows}
      footer={
        <>
          <span>
            Showing {firstShown}–{lastShown} of {total}
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
