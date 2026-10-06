import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { createDriver } from "@/modules/fleet/fleet-management-service";

export const dynamic = "force-dynamic";

export default async function NewDriverPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "driver.write")) redirect("/admin/drivers");

  const db = getDb();
  const classes = await db.vehicleClass.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  async function create(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "driver.write")) {
      redirect("/admin/drivers");
    }

    const expiryRaw = String(formData.get("licenseExpiry") ?? "").trim();
    const licenseExpiry = expiryRaw ? new Date(expiryRaw) : null;

    if (licenseExpiry && Number.isNaN(licenseExpiry.getTime())) {
      throw new Error("Invalid license expiry date.");
    }

    const driver = await createDriver({
      displayName: String(formData.get("displayName") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
      licenseNumber: String(formData.get("licenseNumber") ?? ""),
      licenseExpiry,
      internalNotes: String(formData.get("internalNotes") ?? ""),
      qualificationIds: formData
        .getAll("qualificationIds")
        .map((value) => String(value)),
      actorUserId: currentSession.userId,
    });

    redirect(`/admin/drivers/${driver.id}`);
  }

  return (
    <AdminShell
      active="Drivers & Staff"
      title="New Driver"
      subtitle="Create a non-sensitive driver profile and assign vehicle-class qualifications."
      actions={
        <Link className="admin-secondary-button" href="/admin/drivers">
          ← Drivers
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <form action={create}>
          <label>
            Driver name
            <input name="displayName" required minLength={2} maxLength={120}/>
          </label>

          <label>
            Phone number
            <input
              name="phoneNumber"
              inputMode="tel"
              autoComplete="off"
              placeholder="+91 98765 43210"
              maxLength={40}
            />
          </label>

          <label>
            License number
            <input
              name="licenseNumber"
              autoComplete="off"
              maxLength={80}
            />
          </label>

          <label>
            License expiry
            <input type="date" name="licenseExpiry"/>
          </label>

          <fieldset>
            <legend>Qualified vehicle classes</legend>
            {classes.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  name="qualificationIds"
                  value={item.id}
                />
                {item.name}
              </label>
            ))}
          </fieldset>

          <label>
            Internal notes
            <textarea name="internalNotes" maxLength={1000}/>
          </label>

          <p>
            Phone and license numbers are encrypted with AES-256-GCM before
            they are written to the database. They are never written to audit
            metadata.
          </p>

          <button className="admin-primary-button" type="submit">
            Create Driver
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
