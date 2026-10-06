import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "MAINTENANCE") return "orange";
  if (status === "RETIRED" || status === "INACTIVE") return "red";
  return "gray";
}

export default async function AdminVehiclesPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "vehicle.read")) redirect("/admin");

  const db = getDb();
  const [vehicles, total, active, maintenance, inactive] = await Promise.all([
    db.vehicle.findMany({
      orderBy: [{ status: "asc" }, { displayName: "asc" }],
      include: { vehicleClass: { select: { name: true } } },
      take: 100,
    }),
    db.vehicle.count(),
    db.vehicle.count({ where: { status: "ACTIVE" } }),
    db.vehicle.count({ where: { status: "MAINTENANCE" } }),
    db.vehicle.count({ where: { status: { in: ["INACTIVE", "RETIRED"] } } }),
  ]);

  const rows = vehicles.map((vehicle) => [
    vehicle.registrationNumber,
    vehicle.displayName,
    vehicle.vehicleClass.name,
    vehicle.seats.toString(),
    vehicle.luggage?.toString() ?? "—",
    <StatusPill key={vehicle.id} tone={tone(vehicle.status)}>
      {vehicle.status.replaceAll("_", " ")}
    </StatusPill>,
    vehicle.airConditioned ? "AC" : "Non-AC",
    vehicle.isFeatured ? "Featured" : "—",
  ]);

  return (
    <AdminTablePage
      active="Fleet Management"
      title="Vehicles"
      subtitle="Live fleet inventory used by booking and assignment operations."
      metrics={[
        { label: "Total Vehicles", value: total.toString(), meta: "all fleet records", tone: "blue" },
        { label: "Active", value: active.toString(), meta: "eligible for assignment", tone: "green" },
        { label: "Maintenance", value: maintenance.toString(), meta: "temporarily unavailable", tone: "orange" },
        { label: "Inactive / Retired", value: inactive.toString(), meta: "not assignable", tone: "red" },
      ]}
      filters={["Latest 100"]}
      columns={["Vehicle No.", "Vehicle", "Class", "Seats", "Luggage", "Status", "Comfort", "Featured"]}
      rows={rows}
    />
  );
}
