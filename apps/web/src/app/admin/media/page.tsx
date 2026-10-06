import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function humanBytes(bytes: bigint | null): string {
  if (bytes === null) return "Unknown size";
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MediaPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const [media, total, images, videos, documents] = await Promise.all([
    db.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.mediaAsset.count(),
    db.mediaAsset.count({ where: { mimeType: { startsWith: "image/" } } }),
    db.mediaAsset.count({ where: { mimeType: { startsWith: "video/" } } }),
    db.mediaAsset.count({
      where: {
        NOT: [
          { mimeType: { startsWith: "image/" } },
          { mimeType: { startsWith: "video/" } },
        ],
      },
    }),
  ]);

  return (
    <AdminShell
      active="Media Library"
      title="Media Library"
      subtitle="Live uploaded assets referenced by CMS, destinations, packages and fleet."
    >
      <section className="admin-panel">
        <div className="admin-filter-tabs">
          <button className="admin-filter-tab admin-filter-tab--active">All Files ({total})</button>
          <button className="admin-filter-tab">Images ({images})</button>
          <button className="admin-filter-tab">Videos ({videos})</button>
          <button className="admin-filter-tab">Other ({documents})</button>
        </div>

        {media.length === 0 ? (
          <div className="admin-card-body">
            <p>No media assets have been uploaded yet.</p>
          </div>
        ) : (
          <div className="admin-media-grid">
            {media.map((asset) => (
              <article className="admin-media-card" key={asset.id}>
                {asset.mimeType.startsWith("image/") && asset.publicUrl ? (
                  <img
                    src={asset.publicUrl}
                    alt={asset.altText ?? asset.caption ?? asset.objectKey}
                    loading="lazy"
                  />
                ) : (
                  <div className="admin-media-thumb"/>
                )}
                <strong>{asset.objectKey.split("/").pop() ?? asset.objectKey}</strong>
                <small>
                  {humanBytes(asset.byteSize)} · {asset.mimeType}
                </small>
                <span>{asset.altText ?? asset.caption ?? "No alt text"}</span>
                <small>{asset.createdAt.toLocaleDateString("en-IN")}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
