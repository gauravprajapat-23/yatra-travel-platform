import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminField,
  AdminForm,
  AdminFormActions,
  AdminFormAsideCard,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import { AdminSlugFields } from "@/components/admin-slug-fields";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function assertSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug must use lowercase letters, numbers and single hyphens.");
  }

  if (["admin", "api", "_next"].includes(slug)) {
    throw new Error("This slug is reserved.");
  }
}

export default async function NewCmsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.write")) redirect("/admin/cms");

  async function createPage(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/cms");
    }

    const db = getDb();
    const title = String(formData.get("title") ?? "").trim();
    const slug = normalizeSlug(String(formData.get("slug") ?? ""));
    const excerpt = String(formData.get("excerpt") ?? "").trim();

    if (title.length < 2 || title.length > 180) {
      throw new Error("Title must be between 2 and 180 characters.");
    }

    assertSlug(slug);

    const existing = await db.cmsPage.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      throw new Error("A CMS page with this slug already exists.");
    }

    const page = await db.$transaction(async (tx) => {
      const created = await tx.cmsPage.create({
        data: {
          slug,
          title,
          excerpt: excerpt || null,
          body: [],
          status: "DRAFT",
          robotsIndex: false,
          robotsFollow: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "CMS_PAGE_CREATED",
          entityType: "CmsPage",
          entityId: created.id,
          metadata: {
            slug,
            title,
          },
        },
      });

      return created;
    });

    redirect(`/admin/content/cms/${page.id}`);
  }

  return (
    <AdminShell
      active="CMS Pages"
      title="New CMS Page"
      subtitle="Create the page identity and summary first, then complete structured content, media, SEO and publishing."
      actions={<Link className="admin-secondary-button" href="/admin/cms">← CMS Pages</Link>}
    >
      <AdminForm
        action={createPage}
        aside={
          <>
            <AdminFormAsideCard title="CMS workflow">
              <ul>
                <li>Create the draft URL and title.</li>
                <li>Add structured content blocks.</li>
                <li>Assign hero media and SEO.</li>
                <li>Review before publishing.</li>
              </ul>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Publishing default">
              <p>New CMS pages are non-indexed drafts until publication settings are explicitly changed.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection title="Page identity" description="Primary page title and canonical URL slug." badge="Required">
          <AdminFormGrid columns={2}>
            <AdminSlugFields
              sourceLabel="Page title"
              sourceName="title"
              sourcePlaceholder="Privacy Policy"
              slugPlaceholder="privacy-policy"
              pathPrefix=""
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Content summary" description="Short description used by editors and suitable for later SEO refinement.">
          <AdminFormGrid columns={1}>
            <AdminTextareaField
              id="excerpt"
              name="excerpt"
              label="Short description"
              maxLength={500}
              rows={5}
              placeholder="Briefly explain what this page covers."
              hint="Used by editors and suitable for later SEO refinement."
            />
          </AdminFormGrid>
          <AdminFormCallout title="Safe by default">
            The page is created as a DRAFT with robots indexing disabled. Structured body, hero media, SEO metadata and publication are completed in the editor.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions submitLabel="Create Draft Page" cancelHref="/admin/cms" helper="Creates a non-indexed CMS draft." />
      </AdminForm>
    </AdminShell>
  );
}
