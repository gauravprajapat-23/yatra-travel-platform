import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminPanelHeading, AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminConfirmSubmitButton } from "@/components/admin-confirm-submit-button";
import { AdminStructuredContentEditor } from "@/components/admin-structured-content-editor";
import { AdminMediaPicker } from "@/components/admin-media-picker";
import { AdminJsonListField } from "@/components/admin-json-list-field";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import { AdminTextInputField } from "@/components/admin-text-input-field";
import { AdminPublicationFields } from "@/components/admin-publication-fields";
import { AdminCheckbox, AdminField, AdminFormGrid } from "@/components/admin-form";
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
  updateDestinationDetails,
} from "@/modules/content/destination-management-service";
import { updateBlogDetails } from "@/modules/content/blog-management-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

function publicPath(
  type: "cms" | "blog" | "destination",
  slug: string,
) {
  if (type === "blog") return `/travel-guides/${slug}`;
  if (type === "destination") return `/destinations/${slug}`;
  return `/${slug}`;
}

function backPath(type: "cms" | "blog" | "destination") {
  if (type === "cms") return "/admin/cms";
  if (type === "blog") return "/admin/blog";
  return "/admin/destinations";
}

export default async function AdminContentEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const { type: rawType, id } = await params;
  const { tab: requestedTab } = await searchParams;
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

  const blogDetails =
    type === "blog"
      ? await db.blogPost.findUnique({
          where: { id },
          select: {
            excerpt: true,
            categoryId: true,
          },
        })
      : null;

  const blogCategories =
    type === "blog"
      ? await db.blogCategory.findMany({
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
          },
        })
      : [];

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

  const availableTabs = [
    "overview",
    ...(type === "blog" || type === "destination" ? ["details"] : []),
    ...(type === "destination" && destinationDetails?.kind === "TEMPLE"
      ? ["temple"]
      : []),
    "content",
    "media",
    "publishing",
  ];

  const activeTab = availableTabs.includes(requestedTab ?? "")
    ? requestedTab!
    : "overview";

  async function saveBlogSpecifics(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect(backPath(contentType));
    }

    if (contentType !== "blog") {
      throw new Error("Blog details can only be edited for blog posts.");
    }

    const categoryId =
      String(formData.get("categoryId") ?? "").trim() || null;

    await updateBlogDetails({
      postId: contentId,
      excerpt: String(formData.get("excerpt") ?? ""),
      categoryId,
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/blog");
    revalidatePath(`/admin/content/blog/${contentId}`);
    revalidatePath("/travel-guides");
    revalidatePath(`/travel-guides/${contentSlug}`);
  }

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
        <div className="admin-shell-actions">
          {content.status === "PUBLISHED" ? (
            <Link
              className="admin-primary-button"
              href={publicPath(type, content.slug)}
              target="_blank"
            >
              View Public Page ↗
            </Link>
          ) : null}
          <Link className="admin-secondary-button" href={backPath(type)}>
            ← Back
          </Link>
        </div>
      }
    >
      <AdminEditorTabs
        basePath={`/admin/content/${type}/${contentId}`}
        active={activeTab}
        tabs={[
          { key: "overview", label: "Overview", description: "Status & identity" },
          ...(type === "blog"
            ? [{ key: "details", label: "Blog Details", description: "Category & excerpt" }]
            : []),
          ...(type === "destination"
            ? [{ key: "details", label: "Destination", description: "Kind & summary" }]
            : []),
          ...(type === "destination" && destinationDetails?.kind === "TEMPLE"
            ? [{ key: "temple", label: "Temple Profile", description: "Darshan & practical info" }]
            : []),
          { key: "content", label: "Content", description: "Structured body" },
          { key: "media", label: "Media", description: "Hero image" },
          { key: "publishing", label: "SEO & Publishing", description: "Metadata & visibility" },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <AdminPanelHeading
              title="Publication Overview"
              meta={
                <StatusPill tone={tone(content.status)}>
                {content.status.replaceAll("_", " ")}
              </StatusPill>
              }
            />
            <dl>
              <div><dt>Slug</dt><dd>{content.slug}</dd></div>
              <div><dt>Type</dt><dd>{type.replaceAll("_", " ").toUpperCase()}</dd></div>
              <div><dt>Published</dt><dd>{content.publishedAt?.toLocaleString("en-IN") ?? "Not published"}</dd></div>
              <div><dt>Updated</dt><dd>{content.updatedAt.toLocaleString("en-IN")}</dd></div>
              <div><dt>Search indexing</dt><dd>{content.robotsIndex ? "Allowed" : "Blocked"}</dd></div>
            </dl>
          </section>
        ) : null}

        {activeTab === "details" && type === "blog" && blogDetails ? (
          <section className="admin-panel admin-detail-card">
            <h2>Blog Details</h2>
            {hasPermission(session.roles, "content.write") ? (
              <form action={saveBlogSpecifics}>
                <AdminFormGrid columns={1}>
                  <AdminField label="Category" htmlFor="blogCategory">
                    <select
                      id="blogCategory"
                      name="categoryId"
                      defaultValue={blogDetails.categoryId ?? ""}
                    >
                      <option value="">Uncategorized</option>
                      {blogCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminTextareaField
                    id="blogExcerpt"
                    name="excerpt"
                    label="Excerpt"
                    defaultValue={blogDetails.excerpt ?? ""}
                    maxLength={500}
                    rows={5}
                    hint="Short summary shown in blog listings and previews."
                  />
                </AdminFormGrid>

                <AdminSubmitButton
                  label="Save Blog Details"
                  pendingLabel="Saving Blog Details…"
                />
              </form>
            ) : (
              <dl>
                <div><dt>Category</dt><dd>{blogCategories.find((item) => item.id === blogDetails.categoryId)?.name ?? "Uncategorized"}</dd></div>
                <div><dt>Excerpt</dt><dd>{blogDetails.excerpt ?? "—"}</dd></div>
              </dl>
            )}
          </section>
        ) : null}

        {activeTab === "details" && type === "destination" && destinationDetails ? (
          <section className="admin-panel admin-detail-card">
            <h2>Destination Details</h2>
            {hasPermission(session.roles, "content.write") ? (
              <form action={saveDestinationSpecifics}>
                <AdminFormGrid columns={1}>
                  <AdminField label="Kind" htmlFor="destinationKind" required>
                    <select
                      id="destinationKind"
                      name="kind"
                      defaultValue={destinationDetails.kind}
                    >
                      {destinationKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminTextareaField
                    id="destinationSummary"
                    name="summary"
                    label="Summary"
                    defaultValue={destinationDetails.summary ?? ""}
                    maxLength={700}
                    rows={5}
                    hint="Short public description of this destination."
                  />
                </AdminFormGrid>

                <AdminCheckbox
                  name="isFeatured"
                  defaultChecked={destinationDetails.isFeatured}
                  label="Featured destination"
                  description="Promote this destination in highlighted public sections."
                />

                <p>
                  Remove an existing Temple Profile before changing this
                  destination to a non-temple kind.
                </p>

                <AdminSubmitButton
                  label="Save Destination Details"
                  pendingLabel="Saving Destination…"
                />
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

        {activeTab === "temple" &&
        type === "destination" &&
        destinationDetails?.kind === "TEMPLE" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Temple Profile</h2>
            {hasPermission(session.roles, "content.write") ? (
              <>
                <form action={saveTemple}>
                  <AdminFormGrid columns={2}>
                    <AdminField
                      label="Temple name"
                      htmlFor="templeName"
                      required
                    >
                      <input
                        id="templeName"
                        name="templeName"
                        required
                        minLength={2}
                        maxLength={180}
                        defaultValue={
                          destinationDetails.templeProfile?.templeName ??
                          content.title
                        }
                      />
                    </AdminField>

                    <AdminField label="Deity" htmlFor="templeDeity">
                      <input
                        id="templeDeity"
                        name="deity"
                        maxLength={180}
                        defaultValue={
                          destinationDetails.templeProfile?.deity ?? ""
                        }
                      />
                    </AdminField>

                    <AdminTextareaField
                      id="darshanNotes"
                      name="darshanNotes"
                      label="Darshan notes"
                      maxLength={3000}
                      rows={6}
                      wide
                      defaultValue={
                        destinationDetails.templeProfile?.darshanNotes ?? ""
                      }
                      hint="Timings, queue guidance, special access and visitor expectations."
                    />

                    <AdminTextareaField
                      id="dressCode"
                      name="dressCode"
                      label="Dress code"
                      maxLength={1000}
                      rows={4}
                      wide
                      defaultValue={
                        destinationDetails.templeProfile?.dressCode ?? ""
                      }
                      hint="Temple-specific clothing or entry requirements."
                    />

                    <div className="admin-field admin-field--wide">
                      <AdminJsonListField
                        name="openingHours"
                        label="Opening hours"
                        defaultValue={
                          destinationDetails.templeProfile?.openingHours
                        }
                        hint="Enter one timing or schedule note per line."
                        placeholder={"Daily: 4:00 AM – 11:00 PM\nBhasma Aarti: advance booking required"}
                      />
                    </div>

                    <div className="admin-field admin-field--wide">
                      <AdminJsonListField
                        name="nearbyPlaces"
                        label="Nearby places"
                        defaultValue={
                          destinationDetails.templeProfile?.nearbyPlaces
                        }
                        hint="Enter one nearby attraction, facility or landmark per line."
                        placeholder={"Ram Ghat – 1.5 km\nKal Bhairav Temple – 6 km"}
                      />
                    </div>

                    <div className="admin-field admin-field--wide">
                      <AdminJsonListField
                        name="practicalNotes"
                        label="Practical notes"
                        defaultValue={
                          destinationDetails.templeProfile?.practicalNotes
                        }
                        hint="Enter one visitor tip or operational note per line."
                        placeholder={"Footwear must be left outside\nPhotography restrictions may apply"}
                      />
                    </div>
                  </AdminFormGrid>

                  <AdminSubmitButton
                  label="Save Temple Profile"
                  pendingLabel="Saving Temple Profile…"
                />
                </form>

                {destinationDetails.templeProfile ? (
                  <form action={removeTemple}>
                    <AdminConfirmSubmitButton
                      label="Remove Temple Profile"
                      pendingLabel="Removing Temple Profile…"
                      confirmMessage="Remove this Temple Profile? The destination will keep its normal content, but temple-specific data will be deleted."
                    />
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

        {activeTab === "content" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Structured Content</h2>
            <p>Body content uses safe structured blocks. Raw HTML and scripts are rejected.</p>
            {hasPermission(session.roles, "content.write") ? (
              <form action={saveBody}>
                <AdminStructuredContentEditor
                  initialValue={content.body}
                  mediaOptions={heroOptions.flatMap((asset) =>
                    asset.publicUrl
                      ? [{
                          id: asset.id,
                          publicUrl: asset.publicUrl,
                          label:
                            asset.altText ??
                            asset.objectKey.split("/").pop() ??
                            asset.objectKey,
                          altText: asset.altText,
                        }]
                      : [],
                  )}
                />
                <AdminSubmitButton
                  label="Save Structured Content"
                  pendingLabel="Saving Content…"
                />
              </form>
            ) : (
              <pre>{stringifyStructuredBody(content.body)}</pre>
            )}
          </section>
        ) : null}

        {activeTab === "media" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Hero Media</h2>
            {currentHero?.publicUrl ? (
              <>
                <img src={currentHero.publicUrl} alt={currentHero.altText ?? content.title} loading="lazy"/>
                <p>{currentHero.altText ?? currentHero.objectKey}</p>
              </>
            ) : (
              <p>No hero media assigned.</p>
            )}
            {hasPermission(session.roles, "content.write") ? (
              <form action={saveHero}>
                <AdminMediaPicker
                  name="heroMediaId"
                  defaultValue={content.heroMediaId ?? ""}
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
                  pendingLabel="Saving Hero Image…"
                />
              </form>
            ) : null}
          </section>
        ) : null}

        {activeTab === "publishing" ? (
          <section className="admin-panel admin-detail-card">
            <h2>SEO & Publishing</h2>
            {hasPermission(session.roles, "content.write") ? (
              <form action={save}>
                <AdminFormGrid columns={2}>
                  <AdminField label="Title" htmlFor="contentTitle" required wide>
                    <input
                      id="contentTitle"
                      name="title"
                      defaultValue={content.title}
                      required
                      minLength={2}
                      maxLength={180}
                    />
                  </AdminField>

                  <AdminPublicationFields
                    statuses={contentStatuses.map((status) => ({
                      value: status,
                      label: status.replaceAll("_", " "),
                    }))}
                    defaultStatus={content.status}
                    defaultScheduledFor={
                      content.scheduledFor
                        ? new Date(
                            content.scheduledFor.getTime() -
                              content.scheduledFor.getTimezoneOffset() * 60_000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    statusId="contentStatus"
                    scheduleId="contentScheduledFor"
                  />

                  <AdminTextInputField
                    id="contentSeoTitle"
                    name="seoTitle"
                    label="SEO title"
                    defaultValue={content.seoTitle ?? ""}
                    maxLength={120}
                    wide
                    hint="Search-result title for this content."
                  />

                  <AdminTextareaField
                    id="contentSeoDescription"
                    name="seoDescription"
                    label="SEO description"
                    defaultValue={content.seoDescription ?? ""}
                    maxLength={320}
                    rows={4}
                    wide
                    hint="Search-result description for this content."
                  />

                  <AdminField
                    label="Canonical URL"
                    htmlFor="contentCanonicalUrl"
                    wide
                  >
                    <input
                      id="contentCanonicalUrl"
                      name="canonicalUrl"
                      defaultValue={content.canonicalUrl ?? ""}
                      maxLength={500}
                    />
                  </AdminField>
                </AdminFormGrid>

                <div className="admin-checkbox-grid">
                  <AdminCheckbox
                    name="robotsIndex"
                    defaultChecked={content.robotsIndex}
                    label="Allow search indexing"
                    description="Permit search engines to index this content."
                  />
                  <AdminCheckbox
                    name="robotsFollow"
                    defaultChecked={content.robotsFollow}
                    label="Allow link following"
                    description="Permit search engines to follow links from this content."
                  />
                </div>

                <AdminSubmitButton
                  label="Save SEO & Publishing"
                  pendingLabel="Saving SEO…"
                />
              </form>
            ) : (
              <p>Your role has read-only content access.</p>
            )}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
