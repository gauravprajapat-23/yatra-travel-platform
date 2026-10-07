import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminStructuredContentEditor } from "@/components/admin-structured-content-editor";
import { AdminMediaPicker } from "@/components/admin-media-picker";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminMultiSelectCards } from "@/components/admin-multi-select-cards";
import { AdminMoneyField } from "@/components/admin-money-field";
import { AdminCheckbox, AdminField, AdminFormGrid } from "@/components/admin-form";
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
import {
  stringifyStructuredBody,
  updatePackageStructuredContentBody,
} from "@/modules/content/admin-structured-content-service";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "package.read")) redirect("/admin");

  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const validTabs = [
    "overview",
    "destinations",
    "itinerary",
    "pricing",
    "content",
    "media",
    "publishing",
  ] as const;
  const activeTab = validTabs.includes(
    requestedTab as (typeof validTabs)[number],
  )
    ? (requestedTab as (typeof validTabs)[number])
    : "overview";

  const db = getDb();

  const [pkg, heroOptions, vehicleClasses, allDestinations] = await Promise.all([
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
        publicUrl: true,
        altText: true,
      },
    }),
    db.vehicleClass.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.destination.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),
  ]);

  if (!pkg) notFound();

  const packageId = pkg.id;
  const packageSlug = pkg.slug;
  const packageDurationDays = pkg.durationDays;

  async function saveDestinations(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    const selectedIds = [
      ...new Set(formData.getAll("destinationIds").map((value) => String(value))),
    ];

    if (selectedIds.length > 20) {
      throw new Error("A package cannot contain more than 20 destinations.");
    }

    if (selectedIds.length > 0) {
      const existing = await db.destination.count({
        where: { id: { in: selectedIds } },
      });
      if (existing !== selectedIds.length) {
        throw new Error("One or more selected destinations do not exist.");
      }
    }

    await db.$transaction(async (tx) => {
      await tx.packageDestination.deleteMany({
        where: { packageId },
      });

      if (selectedIds.length > 0) {
        await tx.packageDestination.createMany({
          data: selectedIds.map((destinationId, index) => ({
            packageId,
            destinationId,
            sortOrder: index,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "PACKAGE_DESTINATIONS_UPDATED",
          entityType: "TourPackage",
          entityId: packageId,
          metadata: {
            destinationIds: selectedIds,
          },
        },
      });
    });

    revalidatePath(`/admin/packages/${packageId}`);
    revalidatePath("/admin/packages");
    revalidatePath(`/packages/${packageSlug}`);
  }

  async function saveBody(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "package.write")) {
      redirect("/admin/packages");
    }

    await updatePackageStructuredContentBody({
      packageId,
      actorUserId: currentSession.userId,
      rawBody: String(formData.get("body") ?? "[]"),
    });

    revalidatePath(`/admin/packages/${packageId}`);
    revalidatePath(`/packages/${packageSlug}`);
  }

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
      dayNumber > packageDurationDays
    ) {
      throw new Error(`Day number must be between 1 and ${packageDurationDays}.`);
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
    revalidatePath(`/packages/${packageSlug}`);
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
    revalidatePath(`/packages/${packageSlug}`);
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
    revalidatePath(`/packages/${packageSlug}`);
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
    revalidatePath(`/packages/${packageSlug}`);
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
      subtitle={`${packageDurationDays}D / ${pkg.durationNights}N · ${packageSlug}`}
      actions={
        <Link className="admin-secondary-button" href="/admin/packages">
          ← All Packages
        </Link>
      }
    >
      <AdminEditorTabs
        basePath={`/admin/packages/${packageId}`}
        active={activeTab}
        tabs={[
          { key: "overview", label: "Overview", description: "Status & summary" },
          { key: "destinations", label: "Destinations", description: "Route coverage" },
          { key: "itinerary", label: "Itinerary", description: "Day-by-day plan" },
          { key: "pricing", label: "Pricing", description: "Fare options" },
          { key: "content", label: "Content", description: "Structured body" },
          { key: "media", label: "Media", description: "Hero image" },
          { key: "publishing", label: "SEO & Publishing", description: "Visibility & metadata" },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>Package Overview</h2>
              <StatusPill tone={tone(pkg.status)}>
                {pkg.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
            <p>{pkg.summary ?? "No summary provided."}</p>
            <dl>
              <div><dt>Duration</dt><dd>{packageDurationDays}D / {pkg.durationNights}N</dd></div>
              <div><dt>Destinations</dt><dd>{pkg.destinations.map((item) => item.destination.name).join(", ") || "—"}</dd></div>
              <div><dt>Price options</dt><dd>{pkg.priceOptions.length}</dd></div>
              <div><dt>Itinerary days</dt><dd>{pkg.itinerary.length}</dd></div>
              <div><dt>Published</dt><dd>{pkg.publishedAt?.toLocaleString("en-IN") ?? "Not published"}</dd></div>
              <div><dt>Updated</dt><dd>{pkg.updatedAt.toLocaleString("en-IN")}</dd></div>
            </dl>
          </section>
        ) : null}

        {activeTab === "destinations" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Destinations</h2>
            {hasPermission(session.roles, "package.write") ? (
              <form action={saveDestinations}>
                {allDestinations.length === 0 ? (
                  <p>No destinations exist yet. Create destinations first.</p>
                ) : (
                  <AdminMultiSelectCards
                    name="destinationIds"
                    defaultValues={pkg.destinations.map(
                      (item) => item.destinationId,
                    )}
                    options={allDestinations.map((destination) => ({
                      id: destination.id,
                      label: destination.name,
                      meta: destination.status.replaceAll("_", " "),
                    }))}
                  />
                )}
                <p>Selected destinations are stored in the order shown here.</p>
                <AdminSubmitButton
                  label="Save Destinations"
                  pendingLabel="Saving Destinations…"
                />
              </form>
            ) : (
              <p>{pkg.destinations.map((item) => item.destination.name).join(", ") || "No destinations assigned."}</p>
            )}
          </section>
        ) : null}

        {activeTab === "itinerary" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <div>
                <h2>Itinerary</h2>
                <p>Manage the package day-by-day plan within the advertised duration.</p>
              </div>
              <span>{pkg.itinerary.length}/{packageDurationDays} days</span>
            </div>

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
                        <div className="admin-itinerary-actions">
                          <details className="admin-itinerary-edit">
                            <summary>Edit day</summary>
                            <form action={saveItineraryDay}>
                              <input
                                type="hidden"
                                name="dayNumber"
                                value={day.dayNumber}
                              />

                              <AdminField label="Title" htmlFor={`itinerary-title-${day.id}`} required>
                                <input
                                  id={`itinerary-title-${day.id}`}
                                  name="title"
                                  defaultValue={day.title}
                                  required
                                  minLength={2}
                                  maxLength={180}
                                />
                              </AdminField>

                              <AdminField label="Description" htmlFor={`itinerary-description-${day.id}`}>
                                <textarea
                                  id={`itinerary-description-${day.id}`}
                                  name="description"
                                  defaultValue={day.description ?? ""}
                                  maxLength={3000}
                                  rows={5}
                                />
                              </AdminField>

                              <AdminSubmitButton
                                label={`Save Day ${day.dayNumber}`}
                                pendingLabel={`Saving Day ${day.dayNumber}…`}
                              />
                            </form>
                          </details>

                          <form action={deleteItineraryDay}>
                            <input type="hidden" name="itineraryId" value={day.id}/>
                            <AdminSubmitButton
                              className="admin-danger-button"
                              label="Delete Day"
                              pendingLabel="Deleting…"
                            />
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasPermission(session.roles, "package.write") ? (
              <section className="admin-itinerary-create">
                <h3>Add New Day</h3>
                <p>Choose a day number from 1 to {packageDurationDays}. Existing day numbers will be updated instead of duplicated.</p>

                <form action={saveItineraryDay}>
                  <AdminFormGrid columns={2}>
                    <AdminField label="Day number" htmlFor="newItineraryDay" required>
                      <input
                        id="newItineraryDay"
                        type="number"
                        name="dayNumber"
                        min={1}
                        max={packageDurationDays}
                        required
                      />
                    </AdminField>

                    <AdminField label="Title" htmlFor="newItineraryTitle" required>
                      <input
                        id="newItineraryTitle"
                        name="title"
                        required
                        minLength={2}
                        maxLength={180}
                        placeholder="Arrival and local sightseeing"
                      />
                    </AdminField>

                    <AdminField label="Description" htmlFor="newItineraryDescription" wide>
                      <textarea
                        id="newItineraryDescription"
                        name="description"
                        maxLength={3000}
                        rows={6}
                        placeholder="Describe transfers, sightseeing, meals, stays and key activities."
                      />
                    </AdminField>
                  </AdminFormGrid>

                  <AdminSubmitButton
                    label="Add Itinerary Day"
                    pendingLabel="Adding Day…"
                  />
                </form>
              </section>
            ) : null}
          </section>
        ) : null}

        {activeTab === "pricing" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <div>
                <h2>Package Pricing</h2>
                <p>Manage active fare options, traveller ranges and vehicle-specific pricing.</p>
              </div>
              <span>{pkg.priceOptions.length} option{pkg.priceOptions.length === 1 ? "" : "s"}</span>
            </div>

            {pkg.priceOptions.length === 0 ? (
              <p>No package pricing options configured.</p>
            ) : (
              <div className="admin-price-card-grid">
                {pkg.priceOptions.map((option) => (
                  <article
                    className={
                      option.isActive
                        ? "admin-price-card admin-price-card--active"
                        : "admin-price-card"
                    }
                    key={option.id}
                  >
                    <header>
                      <div>
                        <span>{option.mode.replaceAll("_", " ")}</span>
                        <strong>{money(option.amountMinor, option.currency)}</strong>
                      </div>
                      <small>{option.isActive ? "Active" : "Inactive"}</small>
                    </header>

                    <dl>
                      <div>
                        <dt>Travellers</dt>
                        <dd>{option.minTravellers ?? "Any"} – {option.maxTravellers ?? "Any"}</dd>
                      </div>
                      <div>
                        <dt>Vehicle class</dt>
                        <dd>
                          {option.vehicleClassId
                            ? vehicleClasses.find(
                                (item) => item.id === option.vehicleClassId,
                              )?.name ?? "Unknown"
                            : "Not applicable"}
                        </dd>
                      </div>
                      <div>
                        <dt>Sort order</dt>
                        <dd>{option.sortOrder}</dd>
                      </div>
                    </dl>

                    {hasPermission(session.roles, "package.write") ? (
                      <>
                        <details className="admin-price-card__edit">
                          <summary>Edit pricing option</summary>
                          <form action={savePriceOption}>
                            <input type="hidden" name="optionId" value={option.id}/>

                            <AdminFormGrid columns={2}>
                              <AdminField label="Mode" htmlFor={`price-mode-${option.id}`}>
                                <select
                                  id={`price-mode-${option.id}`}
                                  name="mode"
                                  defaultValue={option.mode}
                                >
                                  {packagePriceModes.map((mode) => (
                                    <option key={mode} value={mode}>
                                      {mode.replaceAll("_", " ")}
                                    </option>
                                  ))}
                                </select>
                              </AdminField>

                              <AdminMoneyField
                                name="amount"
                                label="Price"
                                currency={option.currency}
                                currencyInputId={`price-currency-${option.id}`}
                                defaultValue={(Number(option.amountMinor) / 100).toFixed(2)}
                                required
                              />

                              <AdminField label="Currency" htmlFor={`price-currency-${option.id}`} required>
                                <input
                                  id={`price-currency-${option.id}`}
                                  name="currency"
                                  defaultValue={option.currency}
                                  maxLength={3}
                                  required
                                />
                              </AdminField>

                              <AdminField label="Sort order" htmlFor={`price-sort-${option.id}`}>
                                <input
                                  id={`price-sort-${option.id}`}
                                  type="number"
                                  name="sortOrder"
                                  defaultValue={option.sortOrder}
                                />
                              </AdminField>

                              <AdminField label="Minimum travellers" htmlFor={`price-min-${option.id}`}>
                                <input
                                  id={`price-min-${option.id}`}
                                  type="number"
                                  name="minTravellers"
                                  min={1}
                                  defaultValue={option.minTravellers ?? ""}
                                />
                              </AdminField>

                              <AdminField label="Maximum travellers" htmlFor={`price-max-${option.id}`}>
                                <input
                                  id={`price-max-${option.id}`}
                                  type="number"
                                  name="maxTravellers"
                                  min={1}
                                  defaultValue={option.maxTravellers ?? ""}
                                />
                              </AdminField>

                              <AdminField label="Vehicle class" htmlFor={`price-vehicle-${option.id}`} wide>
                                <select
                                  id={`price-vehicle-${option.id}`}
                                  name="vehicleClassId"
                                  defaultValue={option.vehicleClassId ?? ""}
                                >
                                  <option value="">Not applicable</option>
                                  {vehicleClasses.map((vehicleClass) => (
                                    <option key={vehicleClass.id} value={vehicleClass.id}>
                                      {vehicleClass.name}
                                    </option>
                                  ))}
                                </select>
                              </AdminField>
                            </AdminFormGrid>

                            <AdminSubmitButton
                              label="Update Price Option"
                              pendingLabel="Updating Price…"
                            />
                          </form>
                        </details>

                        <form action={togglePriceOption}>
                          <input type="hidden" name="optionId" value={option.id}/>
                          <button
                            className="admin-secondary-button"
                            type="submit"
                          >
                            {option.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </form>
                      </>
                    ) : null}
                  </article>
                ))}
              </div>
            )}

            {hasPermission(session.roles, "package.write") ? (
              <section className="admin-price-create">
                <h3>Add Price Option</h3>
                <p>Create another fare option for a traveller count or vehicle class.</p>

                <form action={savePriceOption}>
                  <AdminFormGrid columns={3}>
                    <AdminField label="Mode" htmlFor="newPriceMode">
                      <select id="newPriceMode" name="mode" defaultValue="PER_PERSON">
                        {packagePriceModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </AdminField>

                    <AdminMoneyField
                      name="amount"
                      label="Price"
                      currency="INR"
                      currencyInputId="newPriceCurrency"
                      placeholder="14000"
                      required
                    />

                    <AdminField label="Currency" htmlFor="newPriceCurrency" required>
                      <input
                        id="newPriceCurrency"
                        name="currency"
                        defaultValue="INR"
                        maxLength={3}
                        required
                      />
                    </AdminField>

                    <AdminField label="Minimum travellers" htmlFor="newPriceMin">
                      <input id="newPriceMin" type="number" name="minTravellers" min={1}/>
                    </AdminField>

                    <AdminField label="Maximum travellers" htmlFor="newPriceMax">
                      <input id="newPriceMax" type="number" name="maxTravellers" min={1}/>
                    </AdminField>

                    <AdminField label="Sort order" htmlFor="newPriceSort">
                      <input id="newPriceSort" type="number" name="sortOrder" defaultValue={0}/>
                    </AdminField>

                    <AdminField label="Vehicle class" htmlFor="newPriceVehicle" wide>
                      <select id="newPriceVehicle" name="vehicleClassId" defaultValue="">
                        <option value="">Not applicable</option>
                        {vehicleClasses.map((vehicleClass) => (
                          <option key={vehicleClass.id} value={vehicleClass.id}>
                            {vehicleClass.name}
                          </option>
                        ))}
                      </select>
                    </AdminField>
                  </AdminFormGrid>

                  <AdminSubmitButton
                    label="Add Price Option"
                    pendingLabel="Adding Price…"
                  />
                </form>
              </section>
            ) : null}
          </section>
        ) : null}

        {activeTab === "content" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Structured Body</h2>
            <p>Long-form package content is stored as safe structured blocks. Raw HTML/script is rejected.</p>
            {hasPermission(session.roles, "package.write") ? (
              <form action={saveBody}>
                <AdminStructuredContentEditor initialValue={pkg.body} />
                <AdminSubmitButton
                  label="Save Package Content"
                  pendingLabel="Saving Content…"
                />
              </form>
            ) : (
              <pre>{stringifyStructuredBody(pkg.body)}</pre>
            )}
          </section>
        ) : null}

        {activeTab === "media" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Hero Media</h2>
            {pkg.heroMedia?.publicUrl ? (
              <img src={pkg.heroMedia.publicUrl} alt={pkg.heroMedia.altText ?? pkg.title} loading="lazy"/>
            ) : (
              <p>No hero image assigned.</p>
            )}
            {hasPermission(session.roles, "package.write") ? (
              <form action={saveHero}>
                <AdminMediaPicker
                  name="heroMediaId"
                  defaultValue={pkg.heroMediaId ?? ""}
                  options={heroOptions.map((asset) => ({
                    id: asset.id,
                    publicUrl: asset.publicUrl,
                    label:
                      asset.altText ??
                      asset.objectKey.split("/").pop() ??
                      asset.objectKey,
                    altText: asset.altText,
                  }))}
                />
                <AdminSubmitButton
                  label="Save Hero Image"
                  pendingLabel="Saving Image…"
                />
              </form>
            ) : null}
          </section>
        ) : null}

        {activeTab === "publishing" ? (
          <section className="admin-panel admin-detail-card">
            <h2>SEO & Publishing</h2>
            {hasPermission(session.roles, "package.write") ? (
              <form action={saveMetadata}>
                <AdminFormGrid columns={2}>
                  <AdminField label="Title" htmlFor="packageTitle" required wide>
                    <input
                      id="packageTitle"
                      name="title"
                      defaultValue={pkg.title}
                      required
                      minLength={2}
                      maxLength={180}
                    />
                  </AdminField>

                  <AdminField
                    label="Summary"
                    htmlFor="packageSummary"
                    wide
                    hint="Short public description used across package surfaces."
                  >
                    <textarea
                      id="packageSummary"
                      name="summary"
                      defaultValue={pkg.summary ?? ""}
                      maxLength={1000}
                      rows={5}
                    />
                  </AdminField>

                  <AdminField label="Status" htmlFor="packageStatus" required>
                    <select
                      id="packageStatus"
                      name="status"
                      defaultValue={pkg.status}
                    >
                      {contentStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField
                    label="Schedule date"
                    htmlFor="packageScheduledFor"
                    hint="Only used when the status is scheduled."
                  >
                    <input
                      id="packageScheduledFor"
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
                  </AdminField>

                  <AdminField label="SEO title" htmlFor="packageSeoTitle" wide>
                    <input
                      id="packageSeoTitle"
                      name="seoTitle"
                      defaultValue={pkg.seoTitle ?? ""}
                      maxLength={120}
                    />
                  </AdminField>

                  <AdminField
                    label="SEO description"
                    htmlFor="packageSeoDescription"
                    wide
                    hint="Maximum 320 characters."
                  >
                    <textarea
                      id="packageSeoDescription"
                      name="seoDescription"
                      defaultValue={pkg.seoDescription ?? ""}
                      maxLength={320}
                      rows={4}
                    />
                  </AdminField>

                  <AdminField
                    label="Canonical URL"
                    htmlFor="packageCanonicalUrl"
                    wide
                  >
                    <input
                      id="packageCanonicalUrl"
                      name="canonicalUrl"
                      defaultValue={pkg.canonicalUrl ?? ""}
                      maxLength={500}
                    />
                  </AdminField>
                </AdminFormGrid>

                <div className="admin-checkbox-grid">
                  <AdminCheckbox
                    name="robotsIndex"
                    defaultChecked={pkg.robotsIndex}
                    label="Allow search indexing"
                    description="Permit search engines to index this package."
                  />
                  <AdminCheckbox
                    name="robotsFollow"
                    defaultChecked={pkg.robotsFollow}
                    label="Allow link following"
                    description="Permit search engines to follow links from this package."
                  />
                </div>
                <AdminSubmitButton
                  label="Save SEO & Publishing"
                  pendingLabel="Saving SEO…"
                />
              </form>
            ) : (
              <p>Your role has read-only package access.</p>
            )}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
