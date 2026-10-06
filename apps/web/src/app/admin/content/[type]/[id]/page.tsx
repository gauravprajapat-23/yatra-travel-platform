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
import { assignHeroMedia } from "@/modules/media/media-assignment-service";
import {
  stringifyStructuredBody,
  updateStructuredContentBody,
} from "@/modules/content/admin-structured-content-service";

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
        heroMediaId: string | null;
        body: unknown;
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
        heroMediaId: true,
        body: true,
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
        heroMediaId: true,
        body: true,
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
        heroMediaId: true,
        body: true,
      },
    });

    content = destination
      ? { ...destination, title: destination.name }
      : null;
  }

  if (!content) notFound();

  const heroOptions = await db.mediaAsset.findMany({
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
  });

  const currentHero = content.heroMediaId
    ? heroOptions.find((asset) => asset.id === content.heroMediaId) ?? null
    : null;

  const contentId = content.id;
  const contentType = type;

  async function saveBody(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    await updateStructuredContentBody({
      type: contentType,
      id: contentId,
      actorUserId: currentSession.userId,
      rawBody: String(formData.get("body") ?? "[]"),
    });

    revalidatePath(backPath(contentType));
    revalidatePath(`/admin/content/${contentType}/${contentId}`);
    if (contentType === "destination") {
      revalidatePath(`/destinations/${content.slug}`);
    }
  }

  async function saveHero(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    const value = String(formData.get("heroMediaId") ?? "").trim();

    await assignHeroMedia({
      type: contentType,
      entityId: contentId,
      mediaId: value || null,
      actorUserId: currentSession.userId,
    });

    revalidatePath(backPath(contentType));
    revalidatePath(`/admin/content/${contentType}/${contentId}`);
  }

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
          <h2>Hero Media</h2>
          {currentHero?.publicUrl ? (
            <>
              <img
                src={currentHero.publicUrl}
                alt={currentHero.altText ?? content.title}
                loading="lazy"
              />
              <p>{currentHero.altText ?? currentHero.objectKey}</p>
            </>
          ) : (
            <p>No hero media assigned.</p>
          )}
          {hasPermission(session.roles, "content.write") ? (
            <form action={saveHero}>
              <label>
                Hero image
                <select name="heroMediaId" defaultValue={content.heroMediaId ?? ""}>
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
          <h2>Structured Body</h2>
          <p>
            Body content is stored as safe structured blocks. Raw HTML/script is not accepted.
          </p>
          {hasPermission(session.roles, "content.write") ? (
            <form action={saveBody}>
              <label>
                Structured JSON
                <textarea
                  name="body"
                  defaultValue={stringifyStructuredBody(content.body)}
                  rows={18}
                  spellCheck={false}
                />
              </label>
              <small>
                Supported block types: paragraph, heading, image, gallery, quote, callout, cta, list, routeHighlights, itinerarySummary, faqGroup.
              </small>
              <button className="admin-primary-button" type="submit">
                Save Structured Body
              </button>
            </form>
          ) : (
            <pre>{stringifyStructuredBody(content.body)}</pre>
          )}
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
