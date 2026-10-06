import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function normalizeSlug(value: string) {
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

function assertSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug must use lowercase letters, numbers and single hyphens.");
  }
}

export default async function NewBlogPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.write")) redirect("/admin/blog");

  const db = getDb();
  const categories = await db.blogCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  async function createPost(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/blog");
    }

    const title = String(formData.get("title") ?? "").trim();
    const slug = normalizeSlug(String(formData.get("slug") ?? ""));
    const excerpt = String(formData.get("excerpt") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "").trim() || null;

    if (title.length < 2 || title.length > 180) {
      throw new Error("Title must be between 2 and 180 characters.");
    }
    assertSlug(slug);

    if (categoryId) {
      const category = await db.blogCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) throw new Error("Selected blog category does not exist.");
    }

    const existing = await db.blogPost.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) throw new Error("A blog post with this slug already exists.");

    const post = await db.$transaction(async (tx) => {
      const created = await tx.blogPost.create({
        data: {
          slug,
          title,
          excerpt: excerpt || null,
          body: [],
          categoryId,
          status: "DRAFT",
          robotsIndex: false,
          robotsFollow: false,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: currentSession.userId,
          action: "BLOG_POST_CREATED",
          entityType: "BlogPost",
          entityId: created.id,
          metadata: { slug, title, categoryId },
        },
      });

      return created;
    });

    redirect(`/admin/content/blog/${post.id}`);
  }

  return (
    <AdminShell
      active="Blog"
      title="New Blog Post"
      subtitle="Create a draft, then add structured body, hero media, SEO and publication settings."
      actions={<Link className="admin-secondary-button" href="/admin/blog">← Blog</Link>}
    >
      <section className="admin-panel admin-detail-card">
        <form action={createPost}>
          <label>
            Title
            <input name="title" required minLength={2} maxLength={180}/>
          </label>
          <label>
            Slug
            <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="ujjain-travel-guide"/>
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue="">
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label>
            Excerpt
            <textarea name="excerpt" maxLength={500}/>
          </label>
          <button className="admin-primary-button" type="submit">Create Draft Post</button>
        </form>
      </section>
    </AdminShell>
  );
}
