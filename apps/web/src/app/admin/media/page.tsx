import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { AdminMediaManager } from "@/components/admin-media-manager";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const media = await db.mediaAsset.findMany({
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
    take: 100,
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

  const orphaned = serialized.filter((asset) => asset.referenceCount === 0).length;
  const referenced = serialized.length - orphaned;
  const missingAlt = serialized.filter(
    (asset) => asset.mimeType.startsWith("image/") && !asset.altText,
  ).length;

  return (
    <AdminShell
      active="Media Library"
      title="Media Library"
      subtitle="Upload and manage assets stored through the configured S3-compatible provider."
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Loaded Assets" value={serialized.length.toString()} meta="latest 100" tone="blue"/>
        <AdminMetric label="Referenced" value={referenced.toString()} meta="in active content/fleet" tone="green"/>
        <AdminMetric label="Orphaned" value={orphaned.toString()} meta="safe cleanup candidates" tone="orange"/>
        <AdminMetric label="Images Missing Alt" value={missingAlt.toString()} meta="accessibility cleanup" tone="red"/>
      </div>
      {process.env.MEDIA_WRITE_ENABLED !== "true" ? (
        <p className="admin-notice">
          Media writes are disabled. Complete the storage connectivity drill, then enable MEDIA_WRITE_ENABLED.
        </p>
      ) : null}
      <AdminMediaManager
        media={serialized}
        canWrite={
          process.env.MEDIA_WRITE_ENABLED === "true" &&
          hasPermission(session.roles, "content.write")
        }
      />
    </AdminShell>
  );
}
