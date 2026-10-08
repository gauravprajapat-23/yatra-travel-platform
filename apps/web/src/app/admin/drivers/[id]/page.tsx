import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminPanelHeading, AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminConfirmSubmitButton } from "@/components/admin-confirm-submit-button";
import { AdminMultiSelectCards } from "@/components/admin-multi-select-cards";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate, formatIstDateTime, parseIstDateTimeLocal } from "@/lib/admin/datetime";
import { parseIstDateTimeLocal } from "@/lib/admin/datetime";
import {
  addDriverAvailabilityBlock,
  deleteDriverAvailabilityBlock,
  driverStatuses,
  isDriverStatus,
  updateDriver,
} from "@/modules/fleet/fleet-management-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "ON_LEAVE") return "orange";
  if (status === "SUSPENDED" || status === "INACTIVE") return "red";
  return "gray";
}

export default async function DriverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "driver.read")) redirect("/admin");

  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const activeTab = ["overview", "details", "availability"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
  const db = getDb();

  const [driver, classes] = await Promise.all([
    db.driver.findUnique({
      where: { id },
      include: {
        qualifications: {
          include: {
            vehicleClass: {
              select: { id: true, name: true },
            },
          },
        },
        availability: {
          orderBy: { startsAt: "desc" },
          take: 50,
        },
      },
    }),
    db.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!driver) notFound();

  const driverId = driver.id;
  const qualificationIds = driver.qualifications.map(
    (item) => item.vehicleClassId,
  );

  async function save(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "driver.write")) {
      redirect("/admin/drivers");
    }

    const status = String(formData.get("status") ?? "");
    if (!isDriverStatus(status)) throw new Error("Invalid driver status.");

    const expiryRaw = String(formData.get("licenseExpiry") ?? "").trim();
    const licenseExpiry = expiryRaw ? new Date(expiryRaw) : null;

    if (licenseExpiry && Number.isNaN(licenseExpiry.getTime())) {
      throw new Error("Invalid license expiry date.");
    }

    await updateDriver({
      driverId,
      displayName: String(formData.get("displayName") ?? ""),
      status,
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
      licenseNumber: String(formData.get("licenseNumber") ?? ""),
      licenseExpiry,
      internalNotes: String(formData.get("internalNotes") ?? ""),
      qualificationIds: formData
        .getAll("qualificationIds")
        .map((value) => String(value)),
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${driverId}`);
  }

  async function addBlock(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "driver.write")) {
      redirect("/admin/drivers");
    }

    await addDriverAvailabilityBlock({
      driverId,
      startsAt: parseIstDateTimeLocal(formData.get("startsAt")) ?? new Date(NaN),
      endsAt: parseIstDateTimeLocal(formData.get("endsAt")) ?? new Date(NaN),
      reason: String(formData.get("reason") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/drivers/${driverId}`);
  }

  async function removeBlock(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "driver.write")) {
      redirect("/admin/drivers");
    }

    await deleteDriverAvailabilityBlock({
      driverId,
      blockId: String(formData.get("blockId") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/drivers/${driverId}`);
  }

  return (
    <AdminShell
      active="Drivers & Staff"
      title={driver.displayName}
      subtitle="Driver operations and assignment readiness"
      actions={<Link className="admin-secondary-button" href="/admin/drivers">← Drivers</Link>}
    >
      <AdminEditorTabs
        basePath={`/admin/drivers/${driver.id}`}
        active={activeTab}
        tabs={[
          {
            key: "overview",
            label: "Overview",
            description: "Status & readiness",
            badge: driver.status.replaceAll("_", " "),
            badgeTone: driver.status === "ACTIVE" ? "success" : "neutral",
          },
          {
            key: "details",
            label: "Driver Details",
            description: "Profile & qualifications",
            badge: `${driver.qualifications.length} classes`,
            badgeTone: driver.qualifications.length > 0 ? "success" : "warning",
          },
          {
            key: "availability",
            label: "Availability",
            description: "Time blocks",
            badge: String(driver.availability.length),
            badgeTone: driver.availability.length === 0 ? "success" : "warning",
          },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <AdminPanelHeading
              title="Driver Overview"
              meta={
                <StatusPill tone={tone(driver.status)}>{driver.status.replaceAll("_", " ")}</StatusPill>
              }
            />
            <dl>
              <div><dt>Qualified classes</dt><dd>{driver.qualifications.map((item) => item.vehicleClass.name).join(", ") || "None"}</dd></div>
              <div><dt>License expiry</dt><dd>{driver.licenseExpiry ? formatIstDate(driver.licenseExpiry) : "Not recorded"}</dd></div>
              <div><dt>Protected contact</dt><dd>{driver.phoneLast4 ? `•••• ${driver.phoneLast4}` : "Not available"}</dd></div>
              <div><dt>Availability blocks</dt><dd>{driver.availability.length}</dd></div>
            </dl>
            {driver.internalNotes ? <p>{driver.internalNotes}</p> : null}
          </section>
        ) : null}

        {activeTab === "details" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Edit Driver</h2>
            {hasPermission(session.roles, "driver.write") ? (
              <form action={save}>
                <AdminFormGrid columns={2}>
                  <AdminField label="Driver name" htmlFor="displayName" required>
                    <input
                      id="displayName"
                      name="displayName"
                      defaultValue={driver.displayName}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </AdminField>

                  <AdminField label="Status" htmlFor="status" required>
                    <select id="status" name="status" defaultValue={driver.status}>
                      {driverStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                </AdminFormGrid>
                <AdminFormGrid columns={2}>
                  <AdminField
                    label="Replace phone number"
                    htmlFor="phoneNumber"
                    hint="Leave blank to preserve the current encrypted value."
                  >
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder={
                        driver.phoneLast4
                          ? `Current: •••• ${driver.phoneLast4}`
                          : "Enter phone number"
                      }
                      maxLength={40}
                    />
                  </AdminField>

                  <AdminField
                    label="Replace license number"
                    htmlFor="licenseNumber"
                    hint="Leave blank to preserve the current encrypted value."
                  >
                    <input
                      id="licenseNumber"
                      name="licenseNumber"
                      autoComplete="off"
                      placeholder={
                        driver.licenseNumberCiphertext
                          ? "Encrypted value already stored"
                          : "Enter license number"
                      }
                      maxLength={80}
                    />
                  </AdminField>

                  <AdminField label="License expiry" htmlFor="licenseExpiry">
                    <input
                      id="licenseExpiry"
                      type="date"
                      name="licenseExpiry"
                      defaultValue={
                        driver.licenseExpiry
                          ? driver.licenseExpiry.toISOString().slice(0, 10)
                          : ""
                      }
                    />
                  </AdminField>
                </AdminFormGrid>
                <AdminMultiSelectCards
                  name="qualificationIds"
                  defaultValues={qualificationIds}
                  options={classes.map((item) => ({
                    id: item.id,
                    label: item.name,
                    meta: "Eligible vehicle class",
                  }))}
                />
                <AdminField
                  label="Internal notes"
                  htmlFor="internalNotes"
                  hint="Maximum 1,000 characters. Avoid unnecessary sensitive information."
                >
                  <textarea
                    id="internalNotes"
                    name="internalNotes"
                    defaultValue={driver.internalNotes ?? ""}
                    maxLength={1000}
                    rows={5}
                  />
                </AdminField>

                <p>
                  New phone/license values are encrypted before persistence and
                  excluded from audit logs.
                </p>
                <AdminSubmitButton
                  label="Save Driver"
                  pendingLabel="Saving Driver…"
                />
              </form>
            ) : <p>Your role has read-only driver access.</p>}
          </section>
        ) : null}

        {activeTab === "availability" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Availability Blocks</h2>
            {driver.availability.length === 0 ? (
              <p>No availability blocks recorded.</p>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Starts</th><th>Ends</th><th>Reason</th><th>Action</th></tr></thead>
                <tbody>
                  {driver.availability.map((block) => (
                    <tr key={block.id}>
                      <td>{formatIstDateTime(block.startsAt)}</td>
                      <td>{formatIstDateTime(block.endsAt)}</td>
                      <td>{block.reason ?? "—"}</td>
                      <td>
                        {hasPermission(session.roles, "driver.write") ? (
                          <form action={removeBlock}>
                            <input type="hidden" name="blockId" value={block.id}/>
                            <AdminConfirmSubmitButton
                              label="Delete"
                              pendingLabel="Deleting…"
                              confirmMessage="Delete this driver availability block? This cannot be undone."
                            />
                          </form>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hasPermission(session.roles, "driver.write") ? (
              <form action={addBlock}>
                <h3>Add Availability Block</h3>
                <AdminFormGrid columns={2}>
                  <AdminDateTimeRange
                    startName="startsAt"
                    endName="endsAt"
                    startLabel="Starts"
                    endLabel="Ends"
                    startId="driverBlockStarts"
                    endId="driverBlockEnds"
                    startRequired
                    endRequired
                  />

                  <AdminField
                    label="Reason"
                    htmlFor="driverBlockReason"
                    wide
                    hint="Leave, training or another operational reason."
                  >
                    <textarea
                      id="driverBlockReason"
                      name="reason"
                      maxLength={500}
                      rows={4}
                    />
                  </AdminField>
                </AdminFormGrid>

                <AdminSubmitButton
                  label="Add Block"
                  pendingLabel="Adding Block…"
                />
              </form>
            ) : null}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
