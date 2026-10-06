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
import {
  destinationKinds,
  isDestinationKind,
  removeTempleProfile,
  saveTempleProfile,
  stringifyOptionalJson,
  updateDestinationDetails,
} from "@/modules/content/destination-management-service";

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

  const destinationDetails =
    type === "destination"
      ? await db.destination.findUnique({
          where: { id },
          select: {
            kind: true,
            summary: true,
            isFeatured: true,
            templeProfile: {
              select: {
                id: true,
                templeName: true,
                deity: true,
                darshanNotes: true,
                dressCode: true,
                openingHours: true,
                nearbyPlaces: true,
                practicalNotes: true,
              },
            },
          },
        })
      : null;

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
  const contentSlug = content.slug;
  const contentType = type;

  async function saveDestinationSpecifics(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    if (contentType !== "destination") {
      throw new Error("Destination details can only be edited for destinations.");
    }

    const kind = String(formData.get("kind") ?? "");
    if (!isDestinationKind(kind)) {
      throw new Error("Invalid destination kind.");
    }

    await updateDestinationDetails({
      destinationId: contentId,
      kind,
      summary: String(formData.get("summary") ?? ""),
      isFeatured: formData.get("isFeatured") === "on",
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/destinations");
    revalidatePath(`/admin/content/destination/${contentId}`);
    revalidatePath(`/destinations/${contentSlug}`);
  }

  async function saveTemple(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    if (contentType !== "destination") {
      throw new Error("Temple Profile can only be edited for destinations.");
    }

    await saveTempleProfile({
      destinationId: contentId,
      templeName: String(formData.get("templeName") ?? ""),
      deity: String(formData.get("deity") ?? ""),
      darshanNotes: String(formData.get("darshanNotes") ?? ""),
      dressCode: String(formData.get("dressCode") ?? ""),
      openingHoursJson: String(formData.get("openingHours") ?? ""),
      nearbyPlacesJson: String(formData.get("nearbyPlaces") ?? ""),
      practicalNotesJson: String(formData.get("practicalNotes") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/content/destination/${contentId}`);
    revalidatePath(`/destinations/${contentSlug}`);
  }

  async function removeTemple(formData: FormData) {
    "use server";
    void formData;

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    if (contentType !== "destination") {
      throw new Error("Temple Profile can only be removed from destinations.");
    }

    await removeTempleProfile({
      destinationId: contentId,
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/content/destination/${contentId}`);
    revalidatePath(`/destinations/${contentSlug}`);
  }

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
      revalidatePath(`/destinations/${contentSlug}`);
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

        {type === "destination" && destinationDetails ? (
          <section className="admin-panel admin-detail-card">
            <h2>Destination Details</h2>
            {hasPermission(session.roles, "content.write") ? (
              <form action={saveDestinationSpecifics}>
                <label>
                  Kind
                  <select name="kind" defaultValue={destinationDetails.kind}>
                    {destinationKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Summary
                  <textarea
                    name="summary"
                    defaultValue={destinationDetails.summary ?? ""}
                    maxLength={700}
                  />
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="isFeatured"
                    defaultChecked={destinationDetails.isFeatured}
                  />
                  Featured destination
                </label>

                <p>
                  A destination with an existing Temple Profile must have that
                  profile removed before changing to a non-temple kind.
                </p>

                <button className="admin-secondary-button" type="submit">
                  Save Destination Details
                </button>
              </form>
            ) : (
              <dl>
                <div><dt>Kind</dt><dd>{destinationDetails.kind}</dd></div>
                <div><dt>Summary</dt><dd>{destinationDetails.summary ?? "—"}</dd></div>
                <div><dt>Featured</dt><dd>{destinationDetails.isFeatured ? "Yes" : "No"}</dd></div>
              </dl>
            )}
          </section>
        ) : null}

        {type === "destination" &&
        destinationDetails?.kind === "TEMPLE" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Temple Profile</h2>

            {hasPermission(session.roles, "content.write") ? (
              <>
                <form action={saveTemple}>
                  <label>
                    Temple name
                    <input
                      name="templeName"
                      required
                      minLength={2}
                      maxLength={180}
                      defaultValue={
                        destinationDetails.templeProfile?.templeName ?? content.title
                      }
                    />
                  </label>

                  <label>
                    Deity
                    <input
                      name="deity"
                      maxLength={180}
                      defaultValue={destinationDetails.templeProfile?.deity ?? ""}
                    />
                  </label>

                  <label>
                    Darshan notes
                    <textarea
                      name="darshanNotes"
                      maxLength={3000}
                      defaultValue={
                        destinationDetails.templeProfile?.darshanNotes ?? ""
                      }
                    />
                  </label>

                  <label>
                    Dress code
                    <textarea
                      name="dressCode"
                      maxLength={1000}
                      defaultValue={
                        destinationDetails.templeProfile?.dressCode ?? ""
                      }
                    />
                  </label>

                  <label>
                    Opening hours JSON
                    <textarea
                      name="openingHours"
                      rows={8}
                      spellCheck={false}
                      defaultValue={stringifyOptionalJson(
                        destinationDetails.templeProfile?.openingHours,
                      )}
                    />
                  </label>

                  <label>
                    Nearby places JSON
                    <textarea
                      name="nearbyPlaces"
                      rows={8}
                      spellCheck={false}
                      defaultValue={stringifyOptionalJson(
                        destinationDetails.templeProfile?.nearbyPlaces,
                      )}
                    />
                  </label>

                  <label>
                    Practical notes JSON
                    <textarea
                      name="practicalNotes"
                      rows={8}
                      spellCheck={false}
                      defaultValue={stringifyOptionalJson(
                        destinationDetails.templeProfile?.practicalNotes,
                      )}
                    />
                  </label>

                  <button className="admin-primary-button" type="submit">
                    Save Temple Profile
                  </button>
                </form>

                {destinationDetails.templeProfile ? (
                  <form action={removeTemple}>
                    <button className="admin-danger-button" type="submit">
                      Remove Temple Profile
                    </button>
                  </form>
                ) : null}
              </>
            ) : destinationDetails.templeProfile ? (
              <dl>
                <div><dt>Temple</dt><dd>{destinationDetails.templeProfile.templeName}</dd></div>
                <div><dt>Deity</dt><dd>{destinationDetails.templeProfile.deity ?? "—"}</dd></div>
              </dl>
            ) : (
              <p>No Temple Profile configured.</p>
            )}
          </section>
        ) : null}

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
