import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "INVITED") return "orange";
  if (status === "SUSPENDED" || status === "DISABLED") return "red";
  return "gray";
}

export default async function StaffPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "staff.manage")) redirect("/admin");

  const db = getDb();

  const staff = await db.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            key: { not: "CUSTOMER" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      roles: {
        include: { role: true },
      },
    },
    take: 100,
  });

  const active = staff.filter((user) => user.status === "ACTIVE").length;
  const invited = staff.filter((user) => user.status === "INVITED").length;
  const inactive = staff.filter((user) =>
    ["SUSPENDED", "DISABLED"].includes(user.status),
  ).length;

  const rows = staff.map((user) => [
    <Link key={user.id} href={`/admin/staff/${user.id}`}>
      {user.name ?? "Unnamed staff"}
    </Link>,
    user.email,
    user.roles.map((entry) => entry.role.label).join(", "),
    user.lastLoginAt?.toLocaleString("en-IN") ?? "Never",
    <StatusPill key={user.id} tone={tone(user.status)}>
      {user.status.replaceAll("_", " ")}
    </StatusPill>,
    user.createdAt.toLocaleDateString("en-IN"),
  ]);

  return (
    <AdminTablePage
      active="Staff / Roles"
      title="Staff / Roles"
      subtitle="Live admin users and their assigned RBAC roles."
      metrics={[
        { label: "Total Staff", value: staff.length.toString(), meta: "loaded accounts", tone: "blue" },
        { label: "Active Staff", value: active.toString(), meta: "can sign in", tone: "green" },
        { label: "Pending Invites", value: invited.toString(), meta: "not activated", tone: "orange" },
        { label: "Suspended / Disabled", value: inactive.toString(), meta: "access blocked", tone: "red" },
      ]}
      filters={["Latest 100"]}
      columns={["Name", "Email", "Roles", "Last Login", "Status", "Created"]}
      rows={rows}
    />
  );
}
