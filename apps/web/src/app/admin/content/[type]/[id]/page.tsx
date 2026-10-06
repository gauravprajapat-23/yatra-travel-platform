import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  contentStatuses,
  isAdminContentType,
  isContentStatus,
  updateAdminContent,
} from "@/modules/content/admin-content-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

function backPath(type: "cms" | "blog" | "destination") {
  if (type === "cms") return "/admin/cms";
  if (type === "blog") return "/admin/blog";
  return "/admin/destinations";
}

export default async function AdminContentEditorPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const { type: rawType, id } = await params;
  if (!isAdminContentType(rawType)) notFound();

  const type = rawType;
  const db = getDb();

  let content:
    | {
        id: string;
        title: string;
        slug: string;
        status: string;
        seoTitle: string | null;
        seoDescription: string | null;
        canonicalUrl: string | null;
        robotsIndex: boolean;
        robotsFollow: boolean;
        scheduledFor: Date | null;
        publishedAt: Date | null;
        updatedAt: Date;
      }
    | null = null;

  if (type === "cms") {
    content = await db.cmsPage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        canonicalUrl: true,
        robotsIndex: true,
        robotsFollow: true,
        scheduledFor: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  } else if (type === "blog") {
    content = await db.blogPost.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        canonicalUrl: true,
        robotsIndex: true,
        robotsFollow: true,
        scheduledFor: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  } else {
    const destination = await db.destination.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        canonicalUrl: true,
        robotsIndex: true,
        robotsFollow: true,
        scheduledFor: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    content = destination
      ? { ...destination, title: destination.name }
      : null;
  }

  if (!content) notFound();

  const contentId = content.id;
  const contentType = type;

  async function save(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    const status = String(formData.get("status") ?? "");
    if (!isContentStatus(status)) {
      throw new Error("Invalid content status.");
    }

    await updateAdminContent({
      type: contentType,
      id: contentId,
      actorUserId: currentSession.userId,
      title: String(formData.get("title") ?? ""),
      status,
      seoTitle: String(formData.get("seoTitle") ?? ""),
      seoDescription: String(formData.get("seoDescription") ?? ""),
      canonicalUrl: String(formData.get("canonicalUrl") ?? ""),
      robotsIndex: formData.get("robotsIndex") === "on",
      robotsFollow: formData.get("robotsFollow") === "on",
      scheduledFor: String(formData.get("scheduledFor") ?? ""),
    });

    revalidatePath(backPath(contentType));
    revalidatePath(`/admin/content/${contentType}/${contentId}`);
  }

  return (
    <AdminShell
      active={type === "cms" ? "CMS Pages" : type === "blog" ? "Blog" : "Destinations"}
      title={content.title}
      subtitle={`${type.toUpperCase()} · ${content.slug}`}
      actions={
        <Link className="admin-secondary-button" href={backPath(type)}>
          ← Back
        </Link>
      }
    >
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Publication</h2>
            <StatusPill tone={tone(content.status)}>
              {content.status.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <dl>
            <div><dt>Slug</dt><dd>{content.slug}</dd></div>
            <div><dt>Published</dt><dd>{content.publishedAt?.toLocaleString("en-IN") ?? "Not published"}</dd></div>
            <div><dt>Updated</dt><dd>{content.updatedAt.toLocaleString("en-IN")}</dd></div>
          </dl>
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Edit Metadata</h2>
          {hasPermission(session.roles, "content.write") ? (
            <form action={save}>
              <label>
                Title
                <input name="title" defaultValue={content.title} required minLength={2} maxLength={180}/>
              </label>

              <label>
                Status
                <select name="status" defaultValue={content.status}>
                  {contentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Schedule date
                <input
                  name="scheduledFor"
                  type="datetime-local"
                  defaultValue={
                    content.scheduledFor
                      ? new Date(
                          content.scheduledFor.getTime() -
                            content.scheduledFor.getTimezoneOffset() * 60_000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </label>

              <label>
                SEO title
                <input name="seoTitle" defaultValue={content.seoTitle ?? ""} maxLength={120}/>
              </label>

              <label>
                SEO description
                <textarea
                  name="seoDescription"
                  defaultValue={content.seoDescription ?? ""}
                  maxLength={320}
                />
              </label>

              <label>
                Canonical URL
                <input name="canonicalUrl" defaultValue={content.canonicalUrl ?? ""} maxLength={500}/>
              </label>

              <label>
                <input type="checkbox" name="robotsIndex" defaultChecked={content.robotsIndex}/>
                Allow search indexing
              </label>

              <label>
                <input type="checkbox" name="robotsFollow" defaultChecked={content.robotsFollow}/>
                Allow link following
              </label>

              <button className="admin-primary-button" type="submit">
                Save Content Metadata
              </button>
            </form>
          ) : (
            <p>Your role has read-only content access.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
