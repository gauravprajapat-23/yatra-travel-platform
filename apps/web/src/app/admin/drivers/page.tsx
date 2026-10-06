import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "ON_LEAVE") return "orange";
  if (status === "SUSPENDED" || status === "INACTIVE") return "red";
  return "gray";
}

export default async function AdminDriversPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "driver.read")) redirect("/admin");

  const db = getDb();
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [drivers, total, active, onLeave, docsDue] = await Promise.all([
    db.driver.findMany({
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
      include: {
        qualifications: {
          include: { vehicleClass: { select: { name: true } } },
        },
      },
      take: 100,
    }),
    db.driver.count(),
    db.driver.count({ where: { status: "ACTIVE" } }),
    db.driver.count({ where: { status: "ON_LEAVE" } }),
    db.driver.count({
      where: {
        licenseExpiry: {
          not: null,
          lte: soon,
        },
      },
    }),
  ]);

  const rows = drivers.map((driver) => [
    driver.displayName,
    driver.phoneLast4 ? `•••• ${driver.phoneLast4}` : "Protected",
    driver.qualifications.map((item) => item.vehicleClass.name).join(", ") || "Unqualified",
    driver.licenseExpiry?.toLocaleDateString("en-IN") ?? "Not recorded",
    <StatusPill key={driver.id} tone={tone(driver.status)}>
      {driver.status.replaceAll("_", " ")}
    </StatusPill>,
    driver.licenseExpiry && driver.licenseExpiry <= soon ? "Due soon" : "OK",
    driver.internalNotes ?? "—",
  ]);

  return (
    <AdminTablePage
      active="Drivers & Staff"
      title="Drivers"
      subtitle="Live driver roster with qualifications and document status."
      metrics={[
        { label: "Total Drivers", value: total.toString(), meta: "all records", tone: "blue" },
        { label: "Active Drivers", value: active.toString(), meta: "eligible for assignment", tone: "green" },
        { label: "On Leave", value: onLeave.toString(), meta: "temporarily unavailable", tone: "orange" },
        { label: "Documents Due", value: docsDue.toString(), meta: "license due within 30 days", tone: "red" },
      ]}
      filters={["Latest 100"]}
      columns={["Driver", "Contact", "Qualified Classes", "License Expiry", "Status", "Documents", "Notes"]}
      rows={rows}
    />
  );
}
