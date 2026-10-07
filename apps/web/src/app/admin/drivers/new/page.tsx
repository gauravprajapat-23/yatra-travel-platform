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
      subtitle="Create an operational driver profile, secure private details and assign eligible vehicle classes."
      actions={<Link className="admin-secondary-button" href="/admin/drivers">← Drivers</Link>}
    >
      <AdminForm
        action={create}
        aside={
          <>
            <AdminFormAsideCard title="Private information">
              <p>Phone and license numbers are encrypted before persistence and are excluded from audit metadata.</p>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Assignment eligibility">
              <p>A driver can only be assigned to vehicle classes selected under Qualifications.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection title="Driver identity" description="Operational profile details for booking and fleet assignment." badge="Required">
          <AdminFormGrid columns={2}>
            <AdminField label="Driver name" htmlFor="displayName" required>
              <input id="displayName" name="displayName" required minLength={2} maxLength={120} placeholder="Rajesh Sharma" />
            </AdminField>
            <AdminField label="Phone number" htmlFor="phoneNumber" hint="Encrypted at rest.">
              <input id="phoneNumber" name="phoneNumber" inputMode="tel" autoComplete="off" placeholder="+91 98765 43210" maxLength={40} />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="License details" description="Optional license data used for operational verification.">
          <AdminFormGrid columns={2}>
            <AdminField label="License number" htmlFor="licenseNumber" hint="Encrypted at rest.">
              <input id="licenseNumber" name="licenseNumber" autoComplete="off" maxLength={80} />
            </AdminField>
            <AdminField label="License expiry" htmlFor="licenseExpiry">
              <input id="licenseExpiry" type="date" name="licenseExpiry" />
            </AdminField>
          </AdminFormGrid>
          <AdminFormCallout tone="success" title="Encrypted storage">
            Sensitive driver phone and license values use AES-256-GCM before database persistence.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormSection title="Vehicle qualifications" description="Select every vehicle class this driver is approved to operate.">
          <AdminCheckboxGrid>
            {classes.map((item) => (
              <AdminCheckbox key={item.id} name="qualificationIds" value={item.id} label={item.name} description="Eligible for booking assignment." />
            ))}
          </AdminCheckboxGrid>
        </AdminFormSection>

        <AdminFormSection title="Internal notes" description="Private operational context. Do not add unnecessary sensitive information.">
          <AdminFormGrid columns={1}>
            <AdminField label="Notes" htmlFor="internalNotes" hint="Maximum 1,000 characters.">
              <textarea id="internalNotes" name="internalNotes" maxLength={1000} rows={5} placeholder="Shift preferences, operational notes, or non-sensitive instructions." />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormActions submitLabel="Create Driver" cancelHref="/admin/drivers" helper="Sensitive fields are encrypted before storage." />
      </AdminForm>

  );
}
