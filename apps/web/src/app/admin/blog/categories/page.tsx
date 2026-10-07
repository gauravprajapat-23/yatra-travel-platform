import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createBlogCategory,
  updateBlogCategory,
} from "@/modules/content/blog-management-service";

export const dynamic = "force-dynamic";

export default async function BlogCategoriesPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const categories = await db.blogCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { posts: true },
      },
    },
  });

  async function create(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/blog");
    }

    await createBlogCategory({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/blog/categories");
    revalidatePath("/admin/blog/new");
  }

  async function update(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/blog");
    }

    await updateBlogCategory({
      categoryId: String(formData.get("categoryId") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/blog/categories");
    revalidatePath("/admin/blog");
    revalidatePath("/travel-guides");
  }

  const used = categories.filter((item) => item._count.posts > 0).length;

  return (
    <AdminShell
      active="Blog"
      title="Blog Categories"
      subtitle="Manage the taxonomy used by public travel stories."
      actions={
        <Link className="admin-secondary-button" href="/admin/blog">
          ← Blog Posts
        </Link>
      }
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Categories" value={categories.length.toString()} meta="all categories" tone="blue"/>
        <AdminMetric label="In Use" value={used.toString()} meta="have at least one post" tone="green"/>
        <AdminMetric label="Unused" value={(categories.length - used).toString()} meta="safe taxonomy cleanup candidates" tone="orange"/>
      </div>

      {hasPermission(session.roles, "content.write") ? (
        <section className="admin-panel admin-detail-card">
          <h2>Create Category</h2>
          <form action={create}>
            <AdminFormGrid columns={2}>
              <AdminField label="Name" htmlFor="categoryName" required>
                <input
                  id="categoryName"
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Temple Guides"
                />
              </AdminField>

              <AdminField
                label="Slug"
                htmlFor="categorySlug"
                hint="Leave blank to derive it from the category name."
              >
                <input
                  id="categorySlug"
                  name="slug"
                  placeholder="temple-guides"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  maxLength={120}
                />
              </AdminField>

              <AdminField
                label="Description"
                htmlFor="categoryDescription"
                wide
                hint="Maximum 1,000 characters."
              >
                <textarea
                  id="categoryDescription"
                  name="description"
                  maxLength={1000}
                  rows={4}
                />
              </AdminField>
            </AdminFormGrid>

            <button className="admin-primary-button" type="submit">
              Create Category
            </button>
          </form>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Slug</th>
                <th>Posts</th>
                <th>Description</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={5}>No blog categories exist yet.</td></tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.slug}</td>
                    <td>{category._count.posts}</td>
                    <td>{category.description ?? "—"}</td>
                    <td>
                      {hasPermission(session.roles, "content.write") ? (
                        <form action={update}>
                          <input type="hidden" name="categoryId" value={category.id}/>
                          <input
                            name="name"
                            defaultValue={category.name}
                            required
                            minLength={2}
                            maxLength={120}
                          />
                          <textarea
                            name="description"
                            defaultValue={category.description ?? ""}
                            maxLength={1000}
                          />
                          <button className="admin-secondary-button" type="submit">
                            Save
                          </button>
                        </form>
                      ) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
