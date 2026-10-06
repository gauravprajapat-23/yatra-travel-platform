import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { AdminMediaManager } from "@/components/admin-media-manager";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const media = await db.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
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
  }));

  return (
    <AdminShell
      active="Media Library"
      title="Media Library"
      subtitle="Upload and manage assets stored through the configured S3-compatible provider."
    >
      <AdminMediaManager
        media={serialized}
        canWrite={hasPermission(session.roles, "content.write")}
      />
    </AdminShell>
  );
}
