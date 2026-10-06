import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
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
      subtitle="Create a draft page, then add body, SEO, hero media and publication settings."
      actions={
        <Link className="admin-secondary-button" href="/admin/cms">
          ← CMS Pages
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <form action={createPage}>
          <label>
            Page title
            <input name="title" required minLength={2} maxLength={180}/>
          </label>

          <label>
            Slug
            <input
              name="slug"
              required
              placeholder="privacy-policy"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </label>

          <label>
            Short description
            <textarea name="excerpt" maxLength={500}/>
          </label>

          <p>
            New pages are created as non-indexed drafts. Publish them only after
            their structured body and SEO settings are reviewed.
          </p>

          <button className="admin-primary-button" type="submit">
            Create Draft Page
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
