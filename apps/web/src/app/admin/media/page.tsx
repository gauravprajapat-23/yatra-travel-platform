import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminField } from "@/components/admin-form";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { AdminMediaManager } from "@/components/admin-media-manager";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 160);
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();
  const where: Prisma.MediaAssetWhereInput = q
    ? {
        OR: [
          { objectKey: { contains: q, mode: "insensitive" } },
          { altText: { contains: q, mode: "insensitive" } },
          { caption: { contains: q, mode: "insensitive" } },
          { mimeType: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, allTotal, referencedTotal, missingAltTotal] = await Promise.all([
    db.mediaAsset.count({ where }),
    db.mediaAsset.count(),
    db.mediaAsset.count({
      where: {
        OR: [
          { cmsPageHeroes: { some: {} } },
          { destinationHero: { some: {} } },
          { blogPostHeroes: { some: {} } },
          { vehicleMedia: { some: {} } },
          { packageHeroes: { some: {} } },
        ],
      },
    }),
    db.mediaAsset.count({
      where: {
        mimeType: { startsWith: "image/" },
        OR: [{ altText: null }, { altText: "" }],
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const media = await db.mediaAsset.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          cmsPageHeroes: true,
          destinationHero: true,
          blogPostHeroes: true,
          vehicleMedia: true,
          packageHeroes: true,
        },
      },
    },
    skip,
    take: PAGE_SIZE,
  });

  const serialized = media.map((asset) => ({
    id: asset.id,
    objectKey: asset.objectKey,
    publicUrl: asset.publicUrl,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize?.toString() ?? null,
    altText: asset.altText,
    caption: asset.caption,
    createdAt: asset.createdAt.toISOString(),
    referenceCount:
      asset._count.cmsPageHeroes +
      asset._count.destinationHero +
      asset._count.blogPostHeroes +
      asset._count.vehicleMedia +
      asset._count.packageHeroes,
  }));

  const orphanedTotal = Math.max(0, allTotal - referencedTotal);
  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + media.length, total);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (targetPage > 1) next.set("page", String(targetPage));
    const query = next.toString();
    return query ? `/admin/media?${query}` : "/admin/media";
  }

  return (
    <AdminShell
      active="Media Library"
      title="Media Library"
      subtitle="Upload and manage assets stored through the configured S3-compatible provider."
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Total Assets" value={allTotal.toString()} meta="entire library" tone="blue"/>
        <AdminMetric label="Referenced" value={referencedTotal.toString()} meta="linked from content or fleet" tone="green"/>
        <AdminMetric label="Orphaned" value={orphanedTotal.toString()} meta="not currently referenced" tone="orange"/>
        <AdminMetric label="Images Missing Alt" value={missingAltTotal.toString()} meta="entire library" tone="red"/>
      </div>

      {process.env.MEDIA_WRITE_ENABLED !== "true" ? (
        <p className="admin-notice">
          Media writes are disabled. Complete the storage connectivity drill, then enable MEDIA_WRITE_ENABLED.
        </p>
      ) : null}

      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Search entire library" htmlFor="mediaServerSearch">
            <input
              id="mediaServerSearch"
              name="q"
              defaultValue={q}
              maxLength={160}
              placeholder="Filename, alt text, caption or MIME type"
            />
          </AdminField>
          <button className="admin-primary-button" type="submit">Search</button>
          {q ? (
            <Link className="admin-secondary-button" href="/admin/media">
              Reset
            </Link>
          ) : null}
        </form>
        <p>
          Showing {firstShown}–{lastShown} of {total}
          {q ? ` matching “${q}”` : ""}.
        </p>
      </section>

      <AdminMediaManager
        media={serialized}
        canWrite={
          process.env.MEDIA_WRITE_ENABLED === "true" &&
          hasPermission(session.roles, "content.write")
        }
      />

      <section className="admin-panel admin-card-body">
        <div className="admin-table-pager">
          {safePage > 1 ? (
            <Link className="admin-secondary-button" href={pageHref(safePage - 1)}>
              ← Previous
            </Link>
          ) : null}
          <small>Page {safePage} of {totalPages}</small>
          {safePage < totalPages ? (
            <Link className="admin-secondary-button" href={pageHref(safePage + 1)}>
              Next →
            </Link>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
