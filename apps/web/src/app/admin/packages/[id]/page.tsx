import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  contentStatuses,
  isContentStatus,
} from "@/modules/content/admin-content-service";
import {
  packagePriceModes,
  type PackagePriceMode,
} from "@yatra/domain/package/pricing";
import { assignHeroMedia } from "@/modules/media/media-assignment-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function parseAmountMinor(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Price must be a positive amount with up to two decimals.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));

  if (minor <= 0n) throw new Error("Price must be greater than zero.");
  return minor;
}

function optionalPositiveInt(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Traveller limits must be positive integers.");
  }
  return parsed;
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "package.read")) redirect("/admin");

  const { id } = await params;
  const db = getDb();

  const [pkg, heroOptions, vehicleClasses] = await Promise.all([
    db.tourPackage.findUnique({
      where: { id },
      include: {
        heroMedia: {
          select: {
            id: true,
            publicUrl: true,
            altText: true,
            objectKey: true,
          },
        },
        destinations: {
          include: {
            destination: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        priceOptions: {
          orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
        },
        itinerary: {
          orderBy: { dayNumber: "asc" },
        },
      },
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
        altText: true,
      },
    }),
    db.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!pkg) notFound();

  const packageId = pkg.id;

  async function saveItineraryDay(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const dayNumber = Number(formData.get("dayNumber"));
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (
      !Number.isInteger(dayNumber) ||
      dayNumber < 1 ||
      dayNumber > pkg.durationDays
    ) {
      throw new Error(`Day number must be between 1 and ${pkg.durationDays}.`);
    }

    if (title.length < 2 || title.length > 180) {
      throw new Error("Itinerary title must be between 2 and 180 characters.");
    }

    if (description.length > 3000) {
      throw new Error("Itinerary description is too long.");
    }

    const saved = await db.packageItineraryDay.upsert({
      where: {
        packageId_dayNumber: {
          packageId,
          dayNumber,
        },
      },
      update: {
        title,
        description: description || null,
      },
      create: {
        packageId,
        dayNumber,
        title,
        description: description || null,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: "PACKAGE_ITINERARY_SAVED",
        entityType: "PackageItineraryDay",
        entityId: saved.id,
        metadata: {
          packageId,
          dayNumber,
          title,
        },
      },
    });

    revalidatePath(`/admin/packages/${packageId}`);
    revalidatePath(`/packages/${pkg.slug}`);
  }

  async function deleteItineraryDay(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const itineraryId = String(formData.get("itineraryId") ?? "");
    const day = await db.packageItineraryDay.findFirst({
      where: {
        id: itineraryId,
        packageId,
      },
      select: {
        id: true,
        dayNumber: true,
        title: true,
      },
    });

    if (!day) throw new Error("Itinerary day not found.");

    await db.$transaction([
      db.packageItineraryDay.delete({ where: { id: day.id } }),
      db.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "PACKAGE_ITINERARY_DELETED",
          entityType: "PackageItineraryDay",
          entityId: day.id,
          metadata: {
            packageId,
            dayNumber: day.dayNumber,
            title: day.title,
          },
        },
      }),
    ]);

    revalidatePath(`/admin/packages/${packageId}`);
    revalidatePath(`/packages/${pkg.slug}`);
  }

  async function savePriceOption(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const optionId = String(formData.get("optionId") ?? "").trim();
    const modeValue = String(formData.get("mode") ?? "");
    const currency = String(formData.get("currency") ?? "INR").trim().toUpperCase();
    const amountMinor = parseAmountMinor(String(formData.get("amount") ?? ""));
    const minTravellers = optionalPositiveInt(formData.get("minTravellers"));
    const maxTravellers = optionalPositiveInt(formData.get("maxTravellers"));
    const vehicleClassId = String(formData.get("vehicleClassId") ?? "").trim() || null;
    const sortOrderRaw = Number(formData.get("sortOrder") ?? 0);
    const sortOrder = Number.isInteger(sortOrderRaw) ? sortOrderRaw : 0;

    if (!(packagePriceModes as readonly string[]).includes(modeValue)) {
      throw new Error("Invalid package price mode.");
    }
    const mode = modeValue as PackagePriceMode;

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Currency must be a three-letter uppercase code.");
    }

    if (
      minTravellers !== null &&
      maxTravellers !== null &&
      minTravellers > maxTravellers
    ) {
      throw new Error("Minimum travellers cannot exceed maximum travellers.");
    }

    if (mode === "PER_VEHICLE" && !vehicleClassId) {
      throw new Error("Per-vehicle pricing requires a vehicle class.");
    }

    if (vehicleClassId) {
      const vehicleClass = await db.vehicleClass.findFirst({
        where: {
          id: vehicleClassId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!vehicleClass) throw new Error("Vehicle class is not active.");
    }

    let savedId: string;

    if (optionId) {
      const existing = await db.packagePriceOption.findFirst({
        where: {
          id: optionId,
          packageId,
        },
        select: { id: true },
      });
      if (!existing) throw new Error("Price option not found.");

      const updated = await db.packagePriceOption.update({
        where: { id: existing.id },
        data: {
          mode,
          currency,
          amountMinor,
          vehicleClassId: mode === "PER_VEHICLE" ? vehicleClassId : null,
          minTravellers,
          maxTravellers,
          sortOrder,
        },
      });
      savedId = updated.id;
    } else {
      const created = await db.packagePriceOption.create({
        data: {
          packageId,
          mode,
          currency,
          amountMinor,
          vehicleClassId: mode === "PER_VEHICLE" ? vehicleClassId : null,
          minTravellers,
          maxTravellers,
          sortOrder,
          isActive: true,
        },
      });
      savedId = created.id;
    }

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: optionId ? "PACKAGE_PRICE_UPDATED" : "PACKAGE_PRICE_CREATED",
        entityType: "PackagePriceOption",
        entityId: savedId,
        metadata: {
          packageId,
          mode,
          currency,
          amountMinor: amountMinor.toString(),
          minTravellers,
          maxTravellers,
          vehicleClassId: mode === "PER_VEHICLE" ? vehicleClassId : null,
        },
      },
    });

    revalidatePath(`/admin/packages/${packageId}`);
    revalidatePath(`/packages/${pkg.slug}`);
  }

  async function togglePriceOption(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const optionId = String(formData.get("optionId") ?? "");
    const option = await db.packagePriceOption.findFirst({
      where: {
        id: optionId,
        packageId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!option) throw new Error("Price option not found.");

    const updated = await db.packagePriceOption.update({
      where: { id: option.id },
      data: { isActive: !option.isActive },
    });

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: updated.isActive
          ? "PACKAGE_PRICE_ACTIVATED"
          : "PACKAGE_PRICE_DEACTIVATED",
        entityType: "PackagePriceOption",
        entityId: updated.id,
        metadata: { packageId },
      },
    });

    revalidatePath(`/admin/packages/${packageId}`);
    revalidatePath(`/packages/${pkg.slug}`);
  }

  async function saveMetadata(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const status = String(formData.get("status") ?? "");
    if (!isContentStatus(status)) throw new Error("Invalid package status.");

    const title = String(formData.get("title") ?? "").trim();
    const summary = String(formData.get("summary") ?? "").trim();
    const seoTitle = String(formData.get("seoTitle") ?? "").trim();
    const seoDescription = String(formData.get("seoDescription") ?? "").trim();
    const canonicalUrl = String(formData.get("canonicalUrl") ?? "").trim();
    const scheduledForRaw = String(formData.get("scheduledFor") ?? "").trim();

    if (title.length < 2 || title.length > 180) {
      throw new Error("Package title must be between 2 and 180 characters.");
    }

    const scheduledFor =
      status === "SCHEDULED" ? new Date(scheduledForRaw) : null;

    if (
      status === "SCHEDULED" &&
      (!scheduledForRaw || Number.isNaN(scheduledFor?.getTime()))
    ) {
      throw new Error("A valid schedule date is required.");
    }

    const current = await db.tourPackage.findUnique({
      where: { id: packageId },
      select: {
        title: true,
        summary: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        canonicalUrl: true,
        robotsIndex: true,
        robotsFollow: true,
        scheduledFor: true,
        publishedAt: true,
      },
    });

    if (!current) throw new Error("Package not found.");

    const latestRevision = await db.contentRevision.aggregate({
      where: { entityType: "package", entityId: packageId },
      _max: { version: true },
    });

    await db.$transaction([
      db.contentRevision.create({
        data: {
          entityType: "package",
          entityId: packageId,
          version: (latestRevision._max.version ?? 0) + 1,
          createdBy: currentSession.userId,
          payload: {
            title: current.title,
            summary: current.summary,
            status: current.status,
            seoTitle: current.seoTitle,
            seoDescription: current.seoDescription,
            canonicalUrl: current.canonicalUrl,
            robotsIndex: current.robotsIndex,
            robotsFollow: current.robotsFollow,
            scheduledFor: current.scheduledFor?.toISOString() ?? null,
            publishedAt: current.publishedAt?.toISOString() ?? null,
          },
        },
      }),
      db.tourPackage.update({
        where: { id: packageId },
        data: {
          title,
          summary: summary || null,
          status,
          seoTitle: seoTitle || null,
          seoDescription: seoDescription || null,
          canonicalUrl: canonicalUrl || null,
          robotsIndex: formData.get("robotsIndex") === "on",
          robotsFollow: formData.get("robotsFollow") === "on",
          scheduledFor,
          publishedAt:
            status === "PUBLISHED"
              ? current.publishedAt ?? new Date()
              : current.publishedAt,
        },
      }),
      db.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "PACKAGE_UPDATED",
          entityType: "TourPackage",
          entityId: packageId,
          metadata: {
            fromStatus: current.status,
            toStatus: status,
            title,
          },
        },
      }),
    ]);

    revalidatePath("/admin/packages");
    revalidatePath(`/admin/packages/${packageId}`);
  }

  async function saveHero(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const mediaId = String(formData.get("heroMediaId") ?? "").trim();

    await assignHeroMedia({
      type: "package",
      entityId: packageId,
      mediaId: mediaId || null,
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/packages");
    revalidatePath(`/admin/packages/${packageId}`);
  }

  return (
    <AdminShell
      active="Tours & Packages"
      title={pkg.title}
      subtitle={`${pkg.durationDays}D / ${pkg.durationNights}N · ${pkg.slug}`}
      actions={
        <Link className="admin-secondary-button" href="/admin/packages">
          ← All Packages
        </Link>
      }
    >
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Package Overview</h2>
            <StatusPill tone={tone(pkg.status)}>
              {pkg.status.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <p>{pkg.summary ?? "No summary provided."}</p>
          <dl>
            <div><dt>Destinations</dt><dd>{pkg.destinations.map((item) => item.destination.name).join(", ") || "—"}</dd></div>
            <div><dt>Published</dt><dd>{pkg.publishedAt?.toLocaleString("en-IN") ?? "Not published"}</dd></div>
            <div><dt>Updated</dt><dd>{pkg.updatedAt.toLocaleString("en-IN")}</dd></div>
          </dl>
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Hero Media</h2>
          {pkg.heroMedia?.publicUrl ? (
            <img
              src={pkg.heroMedia.publicUrl}
              alt={pkg.heroMedia.altText ?? pkg.title}
              loading="lazy"
            />
          ) : (
            <p>No hero image assigned.</p>
          )}
          {hasPermission(session.roles, "package.write") ? (
            <form action={saveHero}>
              <label>
                Hero image
                <select name="heroMediaId" defaultValue={pkg.heroMediaId ?? ""}>
                  <option value="">No hero image</option>
                  {heroOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.altText ?? asset.objectKey.split("/").pop() ?? asset.objectKey}
                    </option>
                  ))}
                </select>
              </label>
              <button className="admin-secondary-button" type="submit">
                Save Hero Image
              </button>
            </form>
          ) : null}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Itinerary</h2>
          {pkg.itinerary.length === 0 ? (
            <p>No itinerary days configured.</p>
          ) : (
            <div className="admin-timeline">
              {pkg.itinerary.map((day) => (
                <div key={day.id}>
                  <span>{day.dayNumber}</span>
                  <div>
                    <strong>Day {day.dayNumber}: {day.title}</strong>
                    {day.description ? <p>{day.description}</p> : null}
                    {hasPermission(session.roles, "package.write") ? (
                      <form action={deleteItineraryDay}>
                        <input type="hidden" name="itineraryId" value={day.id}/>
                        <button className="admin-danger-button" type="submit">
                          Delete Day
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasPermission(session.roles, "package.write") ? (
            <form action={saveItineraryDay}>
              <h3>Add or Update Day</h3>
              <label>
                Day number
                <input
                  type="number"
                  name="dayNumber"
                  min={1}
                  max={pkg.durationDays}
                  required
                />
              </label>
              <label>
                Title
                <input name="title" required minLength={2} maxLength={180}/>
              </label>
              <label>
                Description
                <textarea name="description" maxLength={3000}/>
              </label>
              <button className="admin-primary-button" type="submit">
                Save Itinerary Day
              </button>
            </form>
          ) : null}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Pricing</h2>
          {pkg.priceOptions.length === 0 ? (
            <p>No package pricing options configured.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Price</th>
                  <th>Travellers</th>
                  <th>Vehicle Class</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pkg.priceOptions.map((option) => (
                  <tr key={option.id}>
                    <td>{option.mode.replaceAll("_", " ")}</td>
                    <td>{money(option.amountMinor, option.currency)}</td>
                    <td>{option.minTravellers ?? "—"} – {option.maxTravellers ?? "—"}</td>
                    <td>
                      {option.vehicleClassId
                        ? vehicleClasses.find((item) => item.id === option.vehicleClassId)?.name ?? "Unknown"
                        : "—"}
                    </td>
                    <td>{option.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      {hasPermission(session.roles, "package.write") ? (
                        <form action={togglePriceOption}>
                          <input type="hidden" name="optionId" value={option.id}/>
                          <button className="admin-secondary-button" type="submit">
                            {option.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hasPermission(session.roles, "package.write") ? (
            <>
              <h3>Add Price Option</h3>
              <form action={savePriceOption}>
                <label>
                  Mode
                  <select name="mode" defaultValue="PER_PERSON">
                    {packagePriceModes.map((mode) => (
                      <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Price
                  <input
                    name="amount"
                    inputMode="decimal"
                    placeholder="14000"
                    required
                  />
                </label>
                <label>
                  Currency
                  <input name="currency" defaultValue="INR" maxLength={3} required/>
                </label>
                <label>
                  Minimum travellers
                  <input type="number" name="minTravellers" min={1}/>
                </label>
                <label>
                  Maximum travellers
                  <input type="number" name="maxTravellers" min={1}/>
                </label>
                <label>
                  Vehicle class
                  <select name="vehicleClassId" defaultValue="">
                    <option value="">Not applicable</option>
                    {vehicleClasses.map((vehicleClass) => (
                      <option key={vehicleClass.id} value={vehicleClass.id}>
                        {vehicleClass.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sort order
                  <input type="number" name="sortOrder" defaultValue={0}/>
                </label>
                <button className="admin-primary-button" type="submit">
                  Add Price Option
                </button>
              </form>

              {pkg.priceOptions.length ? (
                <>
                  <h3>Edit Existing Price Option</h3>
                  {pkg.priceOptions.map((option) => (
                    <form action={savePriceOption} key={`edit-${option.id}`}>
                      <input type="hidden" name="optionId" value={option.id}/>
                      <strong>{option.mode.replaceAll("_", " ")} · {money(option.amountMinor, option.currency)}</strong>
                      <label>
                        Mode
                        <select name="mode" defaultValue={option.mode}>
                          {packagePriceModes.map((mode) => (
                            <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Price
                        <input
                          name="amount"
                          defaultValue={(Number(option.amountMinor) / 100).toFixed(2)}
                          inputMode="decimal"
                          required
                        />
                      </label>
                      <label>
                        Currency
                        <input name="currency" defaultValue={option.currency} maxLength={3} required/>
                      </label>
                      <label>
                        Minimum travellers
                        <input
                          type="number"
                          name="minTravellers"
                          min={1}
                          defaultValue={option.minTravellers ?? ""}
                        />
                      </label>
                      <label>
                        Maximum travellers
                        <input
                          type="number"
                          name="maxTravellers"
                          min={1}
                          defaultValue={option.maxTravellers ?? ""}
                        />
                      </label>
                      <label>
                        Vehicle class
                        <select name="vehicleClassId" defaultValue={option.vehicleClassId ?? ""}>
                          <option value="">Not applicable</option>
                          {vehicleClasses.map((vehicleClass) => (
                            <option key={vehicleClass.id} value={vehicleClass.id}>
                              {vehicleClass.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Sort order
                        <input type="number" name="sortOrder" defaultValue={option.sortOrder}/>
                      </label>
                      <button className="admin-secondary-button" type="submit">
                        Update Price Option
                      </button>
                    </form>
                  ))}
                </>
              ) : null}
            </>
          ) : null}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Edit Package Metadata</h2>
          {hasPermission(session.roles, "package.write") ? (
            <form action={saveMetadata}>
              <label>
                Title
                <input name="title" defaultValue={pkg.title} required minLength={2} maxLength={180}/>
              </label>
              <label>
                Summary
                <textarea name="summary" defaultValue={pkg.summary ?? ""} maxLength={1000}/>
              </label>
              <label>
                Status
                <select name="status" defaultValue={pkg.status}>
                  {contentStatuses.map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label>
                Schedule date
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  defaultValue={
                    pkg.scheduledFor
                      ? new Date(
                          pkg.scheduledFor.getTime() -
                            pkg.scheduledFor.getTimezoneOffset() * 60_000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>
              <label>
                SEO title
                <input name="seoTitle" defaultValue={pkg.seoTitle ?? ""} maxLength={120}/>
              </label>
              <label>
                SEO description
                <textarea name="seoDescription" defaultValue={pkg.seoDescription ?? ""} maxLength={320}/>
              </label>
              <label>
                Canonical URL
                <input name="canonicalUrl" defaultValue={pkg.canonicalUrl ?? ""} maxLength={500}/>
              </label>
              <label>
                <input type="checkbox" name="robotsIndex" defaultChecked={pkg.robotsIndex}/>
                Allow search indexing
              </label>
              <label>
                <input type="checkbox" name="robotsFollow" defaultChecked={pkg.robotsFollow}/>
                Allow link following
              </label>
              <button className="admin-primary-button" type="submit">
                Save Package
              </button>
            </form>
          ) : (
            <p>Your role has read-only package access.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
