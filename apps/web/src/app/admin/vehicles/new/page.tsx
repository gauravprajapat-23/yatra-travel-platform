import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminCheckbox,
  AdminCheckboxGrid,
  AdminField,
  AdminForm,
  AdminFormActions,
  AdminFormAsideCard,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
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
      subtitle="Add a fleet vehicle with assignment capacity, public visibility and operational details."
      actions={<Link className="admin-secondary-button" href="/admin/vehicles">← Vehicles</Link>}
    >
      <AdminForm
        action={create}
        aside={
          <>
            <AdminFormAsideCard title="Fleet checklist">
              <ul>
                <li>Use the exact registration number.</li>
                <li>Choose the correct vehicle class.</li>
                <li>Set realistic seat and luggage capacity.</li>
                <li>Feature only vehicles suitable for public promotion.</li>
              </ul>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Booking impact">
              <p>Vehicle class and capacity are used by quoting and booking assignment, so operational values must be accurate.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection title="Vehicle identity" description="Core fleet identity used throughout operations and assignment." badge="Required">
          <AdminFormGrid columns={2}>
            <AdminField label="Vehicle name" htmlFor="displayName" required>
              <input id="displayName" name="displayName" required minLength={2} maxLength={120} placeholder="Toyota Innova Crysta" />
            </AdminField>
            <AdminField label="Registration number" htmlFor="registrationNumber" required>
              <input id="registrationNumber" name="registrationNumber" required maxLength={30} placeholder="MP 09 AB 1234" />
            </AdminField>
            <AdminField label="Vehicle class" htmlFor="vehicleClassId" required hint="Controls pricing and driver qualification compatibility.">
              <select id="vehicleClassId" name="vehicleClassId" required defaultValue="">
                <option value="" disabled>Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Capacity & amenities" description="Operational capacity and public-facing vehicle features.">
          <AdminFormGrid columns={2}>
            <AdminField label="Seats" htmlFor="seats" required>
              <input id="seats" type="number" name="seats" min={1} max={80} required />
            </AdminField>
            <AdminField label="Luggage capacity" htmlFor="luggage" hint="Optional bag count/capacity indicator.">
              <input id="luggage" type="number" name="luggage" min={0} max={100} />
            </AdminField>
          </AdminFormGrid>
          <AdminCheckboxGrid>
            <AdminCheckbox name="airConditioned" defaultChecked label="Air conditioned" description="Show this vehicle as AC-equipped." />
            <AdminCheckbox name="isFeatured" label="Featured vehicle" description="Allow this vehicle to appear prominently on public fleet pages." />
          </AdminCheckboxGrid>
        </AdminFormSection>

        <AdminFormSection title="Description" description="Optional public and operational context for this fleet vehicle.">
          <AdminFormGrid columns={1}>
            <AdminField label="Vehicle description" htmlFor="description" hint="Maximum 2,000 characters.">
              <textarea id="description" name="description" maxLength={2000} rows={6} placeholder="Describe comfort, suitability, luggage space and common trip use." />
            </AdminField>
          </AdminFormGrid>
          <AdminFormCallout title="Next step">
            After creation you can add media, update operational status and manage availability from the vehicle detail page.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions submitLabel="Create Vehicle" cancelHref="/admin/vehicles" helper="Creates an operational fleet record." />
      </AdminForm>

  );
}
