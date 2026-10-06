import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { createVehicle } from "@/modules/fleet/fleet-management-service";

export const dynamic = "force-dynamic";

function optionalInt(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) throw new Error("Expected a whole number.");
  return parsed;
}

export default async function NewVehiclePage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "vehicle.write")) redirect("/admin/vehicles");

  const db = getDb();
  const classes = await db.vehicleClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      defaultSeats: true,
      defaultLuggage: true,
    },
  });

  async function create(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    const seats = Number(formData.get("seats"));
    const luggage = optionalInt(formData.get("luggage"));

    const vehicle = await createVehicle({
      displayName: String(formData.get("displayName") ?? ""),
      registrationNumber: String(formData.get("registrationNumber") ?? ""),
      vehicleClassId: String(formData.get("vehicleClassId") ?? ""),
      seats,
      luggage,
      airConditioned: formData.get("airConditioned") === "on",
      description: String(formData.get("description") ?? ""),
      isFeatured: formData.get("isFeatured") === "on",
      actorUserId: currentSession.userId,
    });

    redirect(`/admin/vehicles/${vehicle.id}`);
  }

  return (
    <AdminShell
      active="Fleet Management"
      title="New Vehicle"
      subtitle="Create a fleet record that can be used by pricing and booking assignment."
      actions={
        <Link className="admin-secondary-button" href="/admin/vehicles">
          ← Vehicles
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <form action={create}>
          <label>
            Vehicle name
            <input name="displayName" required minLength={2} maxLength={120} />
          </label>

          <label>
            Registration number
            <input name="registrationNumber" required maxLength={30} />
          </label>

          <label>
            Vehicle class
            <select name="vehicleClassId" required defaultValue="">
              <option value="" disabled>Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Seats
            <input type="number" name="seats" min={1} max={80} required />
          </label>

          <label>
            Luggage capacity
            <input type="number" name="luggage" min={0} max={100} />
          </label>

          <label>
            Description
            <textarea name="description" maxLength={2000} />
          </label>

          <label>
            <input type="checkbox" name="airConditioned" defaultChecked />
            Air conditioned
          </label>

          <label>
            <input type="checkbox" name="isFeatured" />
            Featured on public fleet pages
          </label>

          <button className="admin-primary-button" type="submit">
            Create Vehicle
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
