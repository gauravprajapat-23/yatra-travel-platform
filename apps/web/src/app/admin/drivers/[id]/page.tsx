import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "driver.read")) redirect("/admin");

  const { id } = await params;
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
      startsAt: new Date(String(formData.get("startsAt") ?? "")),
      endsAt: new Date(String(formData.get("endsAt") ?? "")),
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
      actions={
        <Link className="admin-secondary-button" href="/admin/drivers">
          ← Drivers
        </Link>
      }
    >
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Driver Overview</h2>
            <StatusPill tone={tone(driver.status)}>
              {driver.status.replaceAll("_", " ")}
            </StatusPill>
          </div>

          <dl>
            <div>
              <dt>Qualified classes</dt>
              <dd>
                {driver.qualifications
                  .map((item) => item.vehicleClass.name)
                  .join(", ") || "None"}
              </dd>
            </div>
            <div>
              <dt>License expiry</dt>
              <dd>
                {driver.licenseExpiry?.toLocaleDateString("en-IN") ??
                  "Not recorded"}
              </dd>
            </div>
            <div>
              <dt>Protected contact</dt>
              <dd>
                {driver.phoneLast4
                  ? `•••• ${driver.phoneLast4}`
                  : "Not available"}
              </dd>
            </div>
          </dl>

          {driver.internalNotes ? <p>{driver.internalNotes}</p> : null}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Edit Driver</h2>

          {hasPermission(session.roles, "driver.write") ? (
            <form action={save}>
              <label>
                Driver name
                <input
                  name="displayName"
                  defaultValue={driver.displayName}
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>

              <label>
                Status
                <select name="status" defaultValue={driver.status}>
                  {driverStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Replace phone number
                <input
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
              </label>

              <label>
                Replace license number
                <input
                  name="licenseNumber"
                  autoComplete="off"
                  placeholder={
                    driver.licenseNumberCiphertext
                      ? "Encrypted value already stored"
                      : "Enter license number"
                  }
                  maxLength={80}
                />
              </label>

              <label>
                License expiry
                <input
                  type="date"
                  name="licenseExpiry"
                  defaultValue={
                    driver.licenseExpiry
                      ? driver.licenseExpiry.toISOString().slice(0, 10)
                      : ""
                  }
                />
              </label>

              <fieldset>
                <legend>Qualified vehicle classes</legend>
                {classes.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      name="qualificationIds"
                      value={item.id}
                      defaultChecked={qualificationIds.includes(item.id)}
                    />
                    {item.name}
                  </label>
                ))}
              </fieldset>

              <label>
                Internal notes
                <textarea
                  name="internalNotes"
                  defaultValue={driver.internalNotes ?? ""}
                  maxLength={1000}
                />
              </label>

              <p>
                Leave phone/license number blank to keep the current encrypted
                value. New values are encrypted before persistence and are not
                included in audit logs.
              </p>

              <button className="admin-primary-button" type="submit">
                Save Driver
              </button>
            </form>
          ) : (
            <p>Your role has read-only driver access.</p>
          )}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Availability Blocks</h2>

          {driver.availability.length === 0 ? (
            <p>No availability blocks recorded.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Starts</th>
                  <th>Ends</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {driver.availability.map((block) => (
                  <tr key={block.id}>
                    <td>{block.startsAt.toLocaleString("en-IN")}</td>
                    <td>{block.endsAt.toLocaleString("en-IN")}</td>
                    <td>{block.reason ?? "—"}</td>
                    <td>
                      {hasPermission(session.roles, "driver.write") ? (
                        <form action={removeBlock}>
                          <input
                            type="hidden"
                            name="blockId"
                            value={block.id}
                          />
                          <button className="admin-danger-button" type="submit">
                            Delete
                          </button>
                        </form>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hasPermission(session.roles, "driver.write") ? (
            <form action={addBlock}>
              <h3>Add Availability Block</h3>

              <label>
                Starts
                <input type="datetime-local" name="startsAt" required />
              </label>

              <label>
                Ends
                <input type="datetime-local" name="endsAt" required />
              </label>

              <label>
                Reason
                <textarea name="reason" maxLength={500} />
              </label>

              <button className="admin-secondary-button" type="submit">
                Add Block
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}
