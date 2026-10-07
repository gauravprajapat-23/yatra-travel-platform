import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { vehicleStatuses } from "@/modules/fleet/fleet-management-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "MAINTENANCE") return "orange";
  if (status === "RETIRED" || status === "INACTIVE") return "red";
  return "gray";
}

type VehicleStatusValue = (typeof vehicleStatuses)[number];

function isVehicleStatus(value: string): value is VehicleStatusValue {
  return (vehicleStatuses as readonly string[]).includes(value);
}

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "vehicle.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isVehicleStatus(String(params.status ?? ""))
    ? (String(params.status) as VehicleStatusValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const baseWhere: Prisma.VehicleWhereInput = q
    ? {
        OR: [
          { registrationNumber: { contains: q, mode: "insensitive" } },
          { displayName: { contains: q, mode: "insensitive" } },
          {
            vehicleClass: {
              name: { contains: q, mode: "insensitive" },
            },
          },
        ],
      }
    : {};

  const where: Prisma.VehicleWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.vehicle.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [vehicles, active, maintenance, inactive] = await Promise.all([
    db.vehicle.findMany({
      where,
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
      include: { vehicleClass: { select: { name: true } } },
      skip,
      take: PAGE_SIZE,
    }),
    db.vehicle.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    db.vehicle.count({ where: { ...baseWhere, status: "MAINTENANCE" } }),
    db.vehicle.count({
      where: {
        ...baseWhere,
        status: { in: ["INACTIVE", "RETIRED"] },
      },
    }),
  ]);

  const rows = vehicles.map((vehicle) => [
    vehicle.registrationNumber,
    <Link key={vehicle.id} href={`/admin/vehicles/${vehicle.id}`}>
      {vehicle.displayName}
    </Link>,
    vehicle.vehicleClass.name,
    vehicle.seats.toString(),
    vehicle.luggage?.toString() ?? "—",
    <StatusPill key={vehicle.id} tone={tone(vehicle.status)}>
      {vehicle.status.replaceAll("_", " ")}
    </StatusPill>,
    vehicle.airConditioned ? "AC" : "Non-AC",
    vehicle.isFeatured ? "Featured" : "—",
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/vehicles?${query}` : "/admin/vehicles";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + vehicles.length, total);

  return (
    <AdminTablePage
      active="Fleet Management"
      title="Vehicles"
      subtitle="Live fleet inventory used by booking and assignment operations."
      actions={
        hasPermission(session.roles, "vehicle.write") ? (
          <Link className="admin-primary-button" href="/admin/vehicles/new">
            ＋ New Vehicle
          </Link>
        ) : null
      }
      metrics={[
        {
          label: "Matching Vehicles",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Active",
          value: active.toString(),
          meta: "current search",
          tone: "green",
        },
        {
          label: "Maintenance",
          value: maintenance.toString(),
          meta: "current search",
          tone: "orange",
        },
        {
          label: "Inactive / Retired",
          value: inactive.toString(),
          meta: "current search",
          tone: "red",
        },
      ]}
      filters={[
        status ? status.replaceAll("_", " ") : "All statuses",
        q ? `Search: ${q}` : "All vehicles",
      ]}
      toolbar={
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Search" htmlFor="vehicleSearch">
            <input
              id="vehicleSearch"
              name="q"
              defaultValue={q}
              placeholder="Registration, vehicle name or class"
            />
          </AdminField>

          <AdminField label="Status" htmlFor="vehicleStatus">
            <select
              id="vehicleStatus"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">All statuses</option>
              {vehicleStatuses.map((item) => (
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
            <Link className="admin-secondary-button" href="/admin/vehicles">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Vehicle No.",
        "Vehicle",
        "Class",
        "Seats",
        "Luggage",
        "Status",
        "Comfort",
        "Featured",
      ]}
      emptyTitle={
        q || status ? "No vehicles match these filters" : "No fleet vehicles yet"
      }
      emptyMessage={
        q || status
          ? "Clear or change the current fleet filters to see more vehicles."
          : "Add the first fleet vehicle before configuring assignments and availability."
      }
      emptyAction={
        !q &&
        !status &&
        hasPermission(session.roles, "vehicle.write") ? (
          <Link className="admin-primary-button" href="/admin/vehicles/new">
            ＋ Add First Vehicle
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
