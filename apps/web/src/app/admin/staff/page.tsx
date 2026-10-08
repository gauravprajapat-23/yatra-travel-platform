import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate, formatIstDateTime } from "@/lib/admin/datetime";
import {
  adminRoleKeys,
  isAdminRole,
  isStaffStatus,
  staffStatuses,
} from "@/modules/staff/staff-management-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type StaffStatusValue = (typeof staffStatuses)[number];
type AdminRoleValue = (typeof adminRoleKeys)[number];

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "INVITED") return "orange";
  if (status === "SUSPENDED" || status === "DISABLED") return "red";
  return "gray";
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    role?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "staff.manage")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isStaffStatus(String(params.status ?? ""))
    ? (String(params.status) as StaffStatusValue)
    : null;
  const role = isAdminRole(String(params.role ?? ""))
    ? (String(params.role) as AdminRoleValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const adminBoundary: Prisma.UserWhereInput = {
    roles: {
      some: {
        role: {
          key: { not: "CUSTOMER" },
        },
      },
    },
  };

  const baseWhere: Prisma.UserWhereInput = {
    ...adminBoundary,
    ...(role
      ? {
          roles: {
            some: {
              role: { key: role },
            },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            {
              roles: {
                some: {
                  role: {
                    label: { contains: q, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const where: Prisma.UserWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [staff, active, invited, inactive] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: { role: true },
        },
      },
      skip,
      take: PAGE_SIZE,
    }),
    db.user.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    db.user.count({ where: { ...baseWhere, status: "INVITED" } }),
    db.user.count({
      where: {
        ...baseWhere,
        status: { in: ["SUSPENDED", "DISABLED"] },
      },
    }),
  ]);

  const rows = staff.map((user) => [
    <Link key={user.id} href={`/admin/staff/${user.id}`}>
      {user.name ?? "Unnamed staff"}
    </Link>,
    user.email,
    user.roles
      .filter((entry) => entry.role.key !== "CUSTOMER")
      .map((entry) => entry.role.label)
      .join(", ") || "—",
    user.lastLoginAt ? formatIstDateTime(user.lastLoginAt) : "Never",
    <StatusPill key={user.id} tone={tone(user.status)}>
      {user.status.replaceAll("_", " ")}
    </StatusPill>,
    formatIstDate(user.createdAt),
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (role) next.set("role", role);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/staff?${query}` : "/admin/staff";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + staff.length, total);

  return (
    <AdminTablePage
      active="Staff / Roles"
      title="Staff / Roles"
      subtitle="Live admin users and their assigned RBAC roles."
      actions={
        <Link className="admin-primary-button" href="/admin/staff/new">
          ＋ Invite Staff
        </Link>
      }
      metrics={[
        {
          label: "Matching Staff",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Active Staff",
          value: active.toString(),
          meta: "current search/role",
          tone: "green",
        },
        {
          label: "Pending Invites",
          value: invited.toString(),
          meta: "current search/role",
          tone: "orange",
        },
        {
          label: "Suspended / Disabled",
          value: inactive.toString(),
          meta: "current search/role",
          tone: "red",
        },
      ]}
      filters={[
        role ? role.replaceAll("_", " ") : "All admin roles",
        status ? status.replaceAll("_", " ") : "All statuses",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminFormGrid columns={3}>
            <AdminField label="Search" htmlFor="staffSearch">
              <input
                id="staffSearch"
                name="q"
                defaultValue={q}
                placeholder="Name, email or role"
              />
            </AdminField>

            <AdminField label="Role" htmlFor="staffRole">
              <select id="staffRole" name="role" defaultValue={role ?? ""}>
                <option value="">All roles</option>
                {adminRoleKeys.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </AdminField>

            <AdminField label="Status" htmlFor="staffStatusFilter">
              <select
                id="staffStatusFilter"
                name="status"
                defaultValue={status ?? ""}
              >
                <option value="">All statuses</option>
                {staffStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status || role) ? (
            <Link className="admin-secondary-button" href="/admin/staff">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={["Name", "Email", "Roles", "Last Login", "Status", "Created"]}
      rows={rows}
      footer={
        <>
          <span>
            Showing {firstShown}–{lastShown} of {total}
          </span>
          <div className="admin-table-pager">
            {safePage > 1 ? (
              <Link className="admin-secondary-button" href={pageHref(safePage - 1)}>
                ← Previous
              </Link>
            ) : null}
            <small>
              Page {safePage} of {totalPages}
            </small>
            {safePage < totalPages ? (
              <Link className="admin-secondary-button" href={pageHref(safePage + 1)}>
                Next →
              </Link>
            ) : null}
          </div>
        </>
      }
    />
  );
}
