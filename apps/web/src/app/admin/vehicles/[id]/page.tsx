import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminPanelHeading, AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminMediaPicker } from "@/components/admin-media-picker";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminConfirmSubmitButton } from "@/components/admin-confirm-submit-button";
import { AdminCheckbox, AdminField, AdminFormGrid } from "@/components/admin-form";
import { AdminDateTimeRange } from "@/components/admin-date-time-range";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDateTime, parseIstDateTimeLocal } from "@/lib/admin/datetime";
import {
  addVehicleAvailabilityBlock,
  attachVehicleMedia,
  deleteVehicleAvailabilityBlock,
  cancelVehicleMaintenance,
  completeVehicleMaintenance,
  deleteVehicleComplianceDocument,
  detachVehicleMedia,
  isVehicleDocumentType,
  isVehicleStatus,
  saveVehicleComplianceDocument,
  scheduleVehicleMaintenance,
  setPrimaryVehicleMedia,
  startVehicleMaintenance,
  updateVehicle,
  vehicleDocumentTypes,
  vehicleStatuses,
} from "@/modules/fleet/fleet-management-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "MAINTENANCE") return "orange";
  if (status === "INACTIVE" || status === "RETIRED") return "red";
  return "gray";
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) throw new Error("Expected a whole number.");
  return parsed;
}

function optionalMoneyMinor(value: FormDataEntryValue | null): bigint | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(text)) {
    throw new Error("Maintenance cost must be positive with up to two decimals.");
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function optionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = new Date(`${text}T00:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date.");
  return parsed;
}

function money(minor: bigint | null, currency = "INR") {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(minor) / 100);
}

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "vehicle.read")) redirect("/admin");

  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const activeTab = [
    "overview",
    "details",
    "availability",
    "maintenance",
    "compliance",
    "media",
  ].includes(requestedTab ?? "")
    ? requestedTab!
    : "overview";
  const db = getDb();

  const [vehicle, classes, mediaOptions] = await Promise.all([
    db.vehicle.findUnique({
      where: { id },
      include: {
        vehicleClass: true,
        availability: {
          orderBy: { startsAt: "desc" },
          take: 50,
        },
        maintenance: {
          orderBy: { startsAt: "desc" },
          take: 50,
        },
        complianceDocuments: {
          orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
          take: 50,
        },
        media: {
          include: {
            media: {
              select: {
                id: true,
                publicUrl: true,
                altText: true,
                objectKey: true,
              },
            },
          },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
      },
    }),
    db.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.mediaAsset.findMany({
      where: {
        mimeType: { startsWith: "image/" },
        publicUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        objectKey: true,
        publicUrl: true,
        altText: true,
      },
    }),
  ]);

  if (!vehicle) notFound();

  const vehicleId = vehicle.id;

  async function save(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    const status = String(formData.get("status") ?? "");
    if (!isVehicleStatus(status)) throw new Error("Invalid vehicle status.");

    await updateVehicle({
      vehicleId,
      displayName: String(formData.get("displayName") ?? ""),
      vehicleClassId: String(formData.get("vehicleClassId") ?? ""),
      status,
      seats: Number(formData.get("seats")),
      luggage: optionalInt(formData.get("luggage")),
      airConditioned: formData.get("airConditioned") === "on",
      description: String(formData.get("description") ?? ""),
      isFeatured: formData.get("isFeatured") === "on",
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/vehicles");
    revalidatePath(`/admin/vehicles/${vehicleId}`);
  }

  async function addBlock(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    await addVehicleAvailabilityBlock({
      vehicleId,
      startsAt: parseIstDateTimeLocal(formData.get("startsAt")) ?? new Date(NaN),
      endsAt: parseIstDateTimeLocal(formData.get("endsAt")) ?? new Date(NaN),
      reason: String(formData.get("reason") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
  }

  async function attachMedia(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    const mediaId = String(formData.get("mediaId") ?? "");
    if (!mediaId) throw new Error("Media asset is required.");

    await attachVehicleMedia({
      vehicleId,
      mediaId,
      isPrimary: formData.get("isPrimary") === "on",
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/cars");
  }

  async function makePrimary(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    await setPrimaryVehicleMedia({
      vehicleId,
      mediaId: String(formData.get("mediaId") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/cars");
  }

  async function detachMedia(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    await detachVehicleMedia({
      vehicleId,
      mediaId: String(formData.get("mediaId") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/cars");
  }

  async function removeBlock(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    await deleteVehicleAvailabilityBlock({
      vehicleId,
      blockId: String(formData.get("blockId") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
  }

  async function scheduleMaintenance(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    await scheduleVehicleMaintenance({
      vehicleId,
      category: String(formData.get("category") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      startsAt: parseIstDateTimeLocal(formData.get("startsAt")) ?? new Date(NaN),
      endsAt: parseIstDateTimeLocal(formData.get("endsAt")) ?? new Date(NaN),
      odometerKm: optionalInt(formData.get("odometerKm")),
      costMinor: optionalMoneyMinor(formData.get("cost")),
      currency: String(formData.get("currency") ?? "INR"),
      vendor: String(formData.get("vendor") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/admin/dispatch");
    revalidatePath("/admin/dispatch/calendar");
  }

  async function startMaintenance(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }
    await startVehicleMaintenance({
      vehicleId,
      maintenanceId: String(formData.get("maintenanceId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/vehicles/${vehicleId}`);
  }

  async function completeMaintenance(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }
    await completeVehicleMaintenance({
      vehicleId,
      maintenanceId: String(formData.get("maintenanceId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/admin/dispatch");
    revalidatePath("/admin/dispatch/calendar");
  }

  async function cancelMaintenance(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }
    await cancelVehicleMaintenance({
      vehicleId,
      maintenanceId: String(formData.get("maintenanceId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/admin/dispatch");
    revalidatePath("/admin/dispatch/calendar");
  }

  async function createComplianceDocument(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    const type = String(formData.get("type") ?? "");
    if (!isVehicleDocumentType(type)) {
      throw new Error("Invalid compliance document type.");
    }

    await saveVehicleComplianceDocument({
      vehicleId,
      type,
      label: String(formData.get("label") ?? ""),
      referenceLast4: String(formData.get("referenceLast4") ?? ""),
      issuedAt: optionalDate(formData.get("issuedAt")),
      expiresAt: optionalDate(formData.get("expiresAt")),
      blocksDispatch: formData.get("blocksDispatch") === "on",
      notes: String(formData.get("notes") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/admin/dispatch");
  }

  async function removeComplianceDocument(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "vehicle.write")) {
      redirect("/admin/vehicles");
    }

    await deleteVehicleComplianceDocument({
      vehicleId,
      documentId: String(formData.get("documentId") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/admin/dispatch");
  }

  return (
    <AdminShell
      active="Fleet Management"
      title={vehicle.displayName}
      subtitle={vehicle.registrationNumber}
      actions={<Link className="admin-secondary-button" href="/admin/vehicles">← Vehicles</Link>}
    >
      <AdminEditorTabs
        basePath={`/admin/vehicles/${vehicle.id}`}
        active={activeTab}
        tabs={[
          {
            key: "overview",
            label: "Overview",
            description: "Fleet status",
            badge: vehicle.status.replaceAll("_", " "),
            badgeTone: vehicle.status === "ACTIVE" ? "success" : "neutral",
          },
          {
            key: "details",
            label: "Vehicle Details",
            description: "Class & capacity",
            badge: `${vehicle.seats} seats`,
          },
          {
            key: "availability",
            label: "Availability",
            description: "Manual blocks",
            badge: String(vehicle.availability.length),
            badgeTone: vehicle.availability.length === 0 ? "success" : "warning",
          },
          {
            key: "maintenance",
            label: "Maintenance",
            description: "Service lifecycle",
            badge: String(vehicle.maintenance.length),
            badgeTone: vehicle.maintenance.some((item) =>
              ["SCHEDULED", "IN_PROGRESS"].includes(item.status),
            )
              ? "warning"
              : "success",
          },
          {
            key: "compliance",
            label: "Compliance",
            description: "Expiry tracking",
            badge: String(vehicle.complianceDocuments.length),
            badgeTone: vehicle.complianceDocuments.some(
              (item) =>
                item.blocksDispatch &&
                item.expiresAt &&
                item.expiresAt <= new Date(),
            )
              ? "warning"
              : "success",
          },
          {
            key: "media",
            label: "Media",
            description: "Primary & gallery",
            badge: vehicle.media.length > 0
              ? `${vehicle.media.length} assets`
              : "Missing",
            badgeTone: vehicle.media.length > 0 ? "success" : "warning",
          },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <AdminPanelHeading
              title="Vehicle Overview"
              meta={
                <StatusPill tone={tone(vehicle.status)}>{vehicle.status.replaceAll("_", " ")}</StatusPill>
              }
            />
            <dl>
              <div><dt>Class</dt><dd>{vehicle.vehicleClass.name}</dd></div>
              <div><dt>Seats</dt><dd>{vehicle.seats}</dd></div>
              <div><dt>Luggage</dt><dd>{vehicle.luggage ?? "—"}</dd></div>
              <div><dt>Comfort</dt><dd>{vehicle.airConditioned ? "Air conditioned" : "Non-AC"}</dd></div>
              <div><dt>Featured</dt><dd>{vehicle.isFeatured ? "Yes" : "No"}</dd></div>
              <div><dt>Availability blocks</dt><dd>{vehicle.availability.length}</dd></div>
              <div><dt>Attached media</dt><dd>{vehicle.media.length}</dd></div>
            </dl>
            {vehicle.description ? <p>{vehicle.description}</p> : null}
          </section>
        ) : null}

        {activeTab === "details" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Edit Vehicle</h2>
            {hasPermission(session.roles, "vehicle.write") ? (
              <form action={save}>
                <AdminFormGrid columns={2}>
                  <AdminField label="Vehicle name" htmlFor="displayName" required>
                    <input
                      id="displayName"
                      name="displayName"
                      defaultValue={vehicle.displayName}
                      required
                      minLength={2}
                      maxLength={120}
                    />
                  </AdminField>

                  <AdminField label="Vehicle class" htmlFor="vehicleClassId" required>
                    <select
                      id="vehicleClassId"
                      name="vehicleClassId"
                      defaultValue={vehicle.vehicleClassId}
                    >
                      {classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField label="Status" htmlFor="status" required>
                    <select id="status" name="status" defaultValue={vehicle.status}>
                      {vehicleStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField label="Seats" htmlFor="seats" required>
                    <input
                      id="seats"
                      type="number"
                      name="seats"
                      min={1}
                      max={80}
                      defaultValue={vehicle.seats}
                      required
                    />
                  </AdminField>

                  <AdminField label="Luggage capacity" htmlFor="luggage">
                    <input
                      id="luggage"
                      type="number"
                      name="luggage"
                      min={0}
                      max={100}
                      defaultValue={vehicle.luggage ?? ""}
                    />
                  </AdminField>

                  <AdminField
                    label="Description"
                    htmlFor="description"
                    wide
                    hint="Maximum 2,000 characters."
                  >
                    <textarea
                      id="description"
                      name="description"
                      defaultValue={vehicle.description ?? ""}
                      maxLength={2000}
                      rows={6}
                    />
                  </AdminField>
                </AdminFormGrid>

                <div className="admin-checkbox-grid">
                  <AdminCheckbox
                    name="airConditioned"
                    defaultChecked={vehicle.airConditioned}
                    label="Air conditioned"
                    description="Vehicle is equipped with working AC."
                  />
                  <AdminCheckbox
                    name="isFeatured"
                    defaultChecked={vehicle.isFeatured}
                    label="Featured vehicle"
                    description="Show this vehicle prominently in public fleet views."
                  />
                </div>

                <AdminSubmitButton
                  label="Save Vehicle"
                  pendingLabel="Saving Vehicle…"
                />
              </form>
            ) : <p>Your role has read-only fleet access.</p>}
          </section>
        ) : null}

        {activeTab === "availability" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Availability Blocks</h2>
            {vehicle.availability.length === 0 ? (
              <p>No availability blocks recorded.</p>
            ) : (
              <table className="admin-table">
                <thead><tr><th>Starts</th><th>Ends</th><th>Reason</th><th>Action</th></tr></thead>
                <tbody>
                  {vehicle.availability.map((block) => (
                    <tr key={block.id}>
                      <td>{formatIstDateTime(block.startsAt)}</td>
                      <td>{formatIstDateTime(block.endsAt)}</td>
                      <td>{block.reason ?? "—"}</td>
                      <td>
                        {hasPermission(session.roles, "vehicle.write") ? (
                          <form action={removeBlock}>
                            <input type="hidden" name="blockId" value={block.id}/>
                            <AdminConfirmSubmitButton
                              label="Delete"
                              pendingLabel="Deleting…"
                              confirmMessage="Delete this vehicle availability block? This cannot be undone."
                            />
                          </form>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hasPermission(session.roles, "vehicle.write") ? (
              <form action={addBlock}>
                <h3>Add Availability Block</h3>
                <AdminFormGrid columns={2}>
                  <AdminDateTimeRange
                    startName="startsAt"
                    endName="endsAt"
                    startLabel="Starts"
                    endLabel="Ends"
                    startId="vehicleBlockStarts"
                    endId="vehicleBlockEnds"
                    startRequired
                    endRequired
                  />

                  <AdminField
                    label="Reason"
                    htmlFor="vehicleBlockReason"
                    wide
                    hint="Maintenance, reserved hold, inspection or another operational reason."
                  >
                    <textarea
                      id="vehicleBlockReason"
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

        {activeTab === "maintenance" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Maintenance</h2>
            {vehicle.maintenance.length === 0 ? (
              <p>No structured maintenance records yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Service</th>
                      <th>Window</th>
                      <th>Odometer</th>
                      <th>Cost</th>
                      <th>Vendor</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.maintenance.map((item) => (
                      <tr key={item.id}>
                        <td>{item.status.replaceAll("_", " ")}</td>
                        <td>
                          <strong>{item.category}</strong>
                          <br />
                          <small>{item.summary}</small>
                        </td>
                        <td>
                          {formatIstDateTime(item.startsAt)}
                          <br />
                          <small>to {formatIstDateTime(item.endsAt)}</small>
                        </td>
                        <td>{item.odometerKm === null ? "—" : `${item.odometerKm.toLocaleString("en-IN")} km`}</td>
                        <td>{money(item.costMinor, item.currency)}</td>
                        <td>{item.vendor ?? "—"}</td>
                        <td>
                          {hasPermission(session.roles, "vehicle.write") ? (
                            <>
                              {item.status === "SCHEDULED" ? (
                                <form action={startMaintenance}>
                                  <input type="hidden" name="maintenanceId" value={item.id} />
                                  <AdminSubmitButton
                                    className="admin-secondary-button"
                                    label="Start"
                                    pendingLabel="Starting…"
                                  />
                                </form>
                              ) : null}
                              {["SCHEDULED", "IN_PROGRESS"].includes(item.status) ? (
                                <form action={completeMaintenance}>
                                  <input type="hidden" name="maintenanceId" value={item.id} />
                                  <AdminConfirmSubmitButton
                                    label="Complete"
                                    pendingLabel="Completing…"
                                    confirmMessage="Complete this maintenance record and release its linked availability block?"
                                  />
                                </form>
                              ) : null}
                              {item.status === "SCHEDULED" ? (
                                <form action={cancelMaintenance}>
                                  <input type="hidden" name="maintenanceId" value={item.id} />
                                  <AdminConfirmSubmitButton
                                    label="Cancel"
                                    pendingLabel="Cancelling…"
                                    confirmMessage="Cancel this maintenance schedule and release its linked availability block?"
                                  />
                                </form>
                              ) : null}
                            </>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hasPermission(session.roles, "vehicle.write") ? (
              <form action={scheduleMaintenance}>
                <h3>Schedule Maintenance</h3>
                <AdminFormGrid columns={2}>
                  <AdminField label="Category" htmlFor="maintenanceCategory" required>
                    <input
                      id="maintenanceCategory"
                      name="category"
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Periodic service"
                    />
                  </AdminField>
                  <AdminField label="Summary" htmlFor="maintenanceSummary" required>
                    <input
                      id="maintenanceSummary"
                      name="summary"
                      required
                      minLength={2}
                      maxLength={200}
                      placeholder="Engine oil and filter replacement"
                    />
                  </AdminField>
                  <AdminDateTimeRange
                    startName="startsAt"
                    endName="endsAt"
                    startLabel="Starts"
                    endLabel="Ends"
                    startId="maintenanceStarts"
                    endId="maintenanceEnds"
                    startRequired
                    endRequired
                  />
                  <AdminField label="Odometer (km)" htmlFor="maintenanceOdometer">
                    <input id="maintenanceOdometer" name="odometerKm" type="number" min={0} />
                  </AdminField>
                  <AdminField label="Cost" htmlFor="maintenanceCost">
                    <input id="maintenanceCost" name="cost" inputMode="decimal" placeholder="2500.00" />
                  </AdminField>
                  <AdminField label="Currency" htmlFor="maintenanceCurrency">
                    <input
                      id="maintenanceCurrency"
                      name="currency"
                      defaultValue="INR"
                      maxLength={3}
                      pattern="[A-Za-z]{3}"
                    />
                  </AdminField>
                  <AdminField label="Vendor" htmlFor="maintenanceVendor">
                    <input id="maintenanceVendor" name="vendor" maxLength={160} />
                  </AdminField>
                  <AdminField label="Notes" htmlFor="maintenanceNotes" wide>
                    <textarea id="maintenanceNotes" name="notes" maxLength={2000} rows={4} />
                  </AdminField>
                </AdminFormGrid>
                <p>
                  Scheduling maintenance also creates a linked availability block.
                  The service rejects windows that overlap an assigned active trip.
                </p>
                <AdminSubmitButton
                  label="Schedule Maintenance"
                  pendingLabel="Scheduling…"
                />
              </form>
            ) : null}
          </section>
        ) : null}

        {activeTab === "compliance" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Vehicle Compliance</h2>
            {vehicle.complianceDocuments.length === 0 ? (
              <p>No compliance documents recorded.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Label</th>
                      <th>Reference</th>
                      <th>Issued</th>
                      <th>Expires</th>
                      <th>Dispatch impact</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.complianceDocuments.map((document) => {
                      const expired =
                        document.expiresAt && document.expiresAt <= new Date();
                      return (
                        <tr key={document.id}>
                          <td>{document.type.replaceAll("_", " ")}</td>
                          <td>{document.label}</td>
                          <td>{document.referenceLast4 ? `•••• ${document.referenceLast4}` : "—"}</td>
                          <td>{document.issuedAt ? document.issuedAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
                          <td>
                            {document.expiresAt
                              ? document.expiresAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })
                              : "No expiry"}
                            {expired ? " · EXPIRED" : ""}
                          </td>
                          <td>{document.blocksDispatch ? "Blocks when expired" : "Advisory"}</td>
                          <td>
                            {hasPermission(session.roles, "vehicle.write") ? (
                              <form action={removeComplianceDocument}>
                                <input type="hidden" name="documentId" value={document.id} />
                                <AdminConfirmSubmitButton
                                  label="Delete"
                                  pendingLabel="Deleting…"
                                  confirmMessage="Delete this compliance record?"
                                />
                              </form>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {hasPermission(session.roles, "vehicle.write") ? (
              <form action={createComplianceDocument}>
                <h3>Add Compliance Document</h3>
                <AdminFormGrid columns={2}>
                  <AdminField label="Document type" htmlFor="complianceType" required>
                    <select id="complianceType" name="type" defaultValue="INSURANCE">
                      {vehicleDocumentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Label" htmlFor="complianceLabel" required>
                    <input
                      id="complianceLabel"
                      name="label"
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="Comprehensive insurance"
                    />
                  </AdminField>
                  <AdminField
                    label="Reference last 4"
                    htmlFor="complianceReference"
                    hint="Store only the final 1–4 letters/numbers, not the full document number."
                  >
                    <input
                      id="complianceReference"
                      name="referenceLast4"
                      maxLength={4}
                      autoComplete="off"
                    />
                  </AdminField>
                  <AdminField label="Issued date" htmlFor="complianceIssued">
                    <input id="complianceIssued" name="issuedAt" type="date" />
                  </AdminField>
                  <AdminField label="Expiry date" htmlFor="complianceExpiry">
                    <input id="complianceExpiry" name="expiresAt" type="date" />
                  </AdminField>
                  <AdminField label="Notes" htmlFor="complianceNotes" wide>
                    <textarea id="complianceNotes" name="notes" maxLength={1000} rows={4} />
                  </AdminField>
                </AdminFormGrid>
                <AdminCheckbox
                  name="blocksDispatch"
                  defaultChecked
                  label="Block dispatch after expiry"
                  description="Expired required documents will become dispatch blockers once enforcement is certified."
                />
                <AdminSubmitButton
                  label="Add Compliance Document"
                  pendingLabel="Adding…"
                />
              </form>
            ) : null}
          </section>
        ) : null}

        {activeTab === "media" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Vehicle Media</h2>
            {vehicle.media.length === 0 ? (
              <p>No media attached to this vehicle yet.</p>
            ) : (
              <div className="admin-media-grid">
                {vehicle.media.map((item) => (
                  <article className="admin-media-card" key={item.mediaId}>
                    {item.media.publicUrl ? (
                      <img src={item.media.publicUrl} alt={item.media.altText ?? vehicle.displayName} loading="lazy"/>
                    ) : null}
                    <strong>{item.media.altText ?? item.media.objectKey}</strong>
                    <small>{item.isPrimary ? "Primary" : "Gallery"}</small>
                    {hasPermission(session.roles, "vehicle.write") ? (
                      <>
                        {!item.isPrimary ? (
                          <form action={makePrimary}>
                            <input type="hidden" name="mediaId" value={item.mediaId}/>
                            <AdminSubmitButton
                              className="admin-secondary-button"
                              label="Make Primary"
                              pendingLabel="Updating…"
                            />
                          </form>
                        ) : null}
                        <form action={detachMedia}>
                          <input type="hidden" name="mediaId" value={item.mediaId}/>
                          <AdminConfirmSubmitButton
                            label="Detach"
                            pendingLabel="Detaching…"
                            confirmMessage="Detach this media asset from the vehicle? The media file itself will remain in the library."
                          />
                        </form>
                      </>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
            {hasPermission(session.roles, "vehicle.write") ? (
              <form action={attachMedia}>
                <h3>Attach Media</h3>
                <AdminMediaPicker
                  name="mediaId"
                  allowNone={false}
                  options={mediaOptions.map((asset) => ({
                    id: asset.id,
                    publicUrl: asset.publicUrl,
                    label:
                      asset.altText ??
                      asset.objectKey.split("/").pop() ??
                      asset.objectKey,
                    altText: asset.altText,
                  }))}
                />
                <AdminCheckbox
                  name="isPrimary"
                  label="Use as primary fleet image"
                  description="This image becomes the main public fleet image."
                />
                <AdminSubmitButton
                  label="Attach Image"
                  pendingLabel="Attaching…"
                />
              </form>
            ) : null}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
