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

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "package.read")) redirect("/admin");

  const { id } = await params;
  const db = getDb();

  const [pkg, heroOptions] = await Promise.all([
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
  ]);

  if (!pkg) notFound();

  const packageId = pkg.id;

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
          <h2>Pricing</h2>
          {pkg.priceOptions.length === 0 ? (
            <p>No package pricing options configured.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Mode</th><th>Price</th><th>Travellers</th><th>Status</th></tr>
              </thead>
              <tbody>
                {pkg.priceOptions.map((option) => (
                  <tr key={option.id}>
                    <td>{option.mode.replaceAll("_", " ")}</td>
                    <td>{money(option.amountMinor, option.currency)}</td>
                    <td>{option.minTravellers ?? "—"} – {option.maxTravellers ?? "—"}</td>
                    <td>{option.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
