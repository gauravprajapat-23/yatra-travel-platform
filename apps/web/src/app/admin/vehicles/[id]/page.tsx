import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminMediaPicker } from "@/components/admin-media-picker";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminCheckbox, AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import {
  addVehicleAvailabilityBlock,
  attachVehicleMedia,
  deleteVehicleAvailabilityBlock,
  detachVehicleMedia,
  isVehicleStatus,
  setPrimaryVehicleMedia,
  updateVehicle,
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
  const activeTab = ["overview", "details", "availability", "media"].includes(
    requestedTab ?? "",
  )
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
      startsAt: new Date(String(formData.get("startsAt") ?? "")),
      endsAt: new Date(String(formData.get("endsAt") ?? "")),
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
          { key: "overview", label: "Overview", description: "Fleet status" },
          { key: "details", label: "Vehicle Details", description: "Class & capacity" },
          { key: "availability", label: "Availability", description: "Blocks & maintenance" },
          { key: "media", label: "Media", description: "Primary & gallery" },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>Vehicle Overview</h2>
              <StatusPill tone={tone(vehicle.status)}>{vehicle.status.replaceAll("_", " ")}</StatusPill>
            </div>
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
                      <td>{block.startsAt.toLocaleString("en-IN")}</td>
                      <td>{block.endsAt.toLocaleString("en-IN")}</td>
                      <td>{block.reason ?? "—"}</td>
                      <td>
                        {hasPermission(session.roles, "vehicle.write") ? (
                          <form action={removeBlock}>
                            <input type="hidden" name="blockId" value={block.id}/>
                            <button className="admin-danger-button" type="submit">Delete</button>
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
                  <AdminField label="Starts" htmlFor="vehicleBlockStarts" required>
                    <input
                      id="vehicleBlockStarts"
                      type="datetime-local"
                      name="startsAt"
                      required
                    />
                  </AdminField>

                  <AdminField label="Ends" htmlFor="vehicleBlockEnds" required>
                    <input
                      id="vehicleBlockEnds"
                      type="datetime-local"
                      name="endsAt"
                      required
                    />
                  </AdminField>

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

                <button className="admin-primary-button" type="submit">
                  Add Block
                </button>
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
                          <button className="admin-danger-button" type="submit">Detach</button>
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
