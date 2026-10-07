import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";
import { contentStatuses } from "@/modules/content/admin-content-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type ContentStatusValue = (typeof contentStatuses)[number];

function isContentStatus(value: string): value is ContentStatusValue {
  return (contentStatuses as readonly string[]).includes(value);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isContentStatus(String(params.status ?? ""))
    ? (String(params.status) as ContentStatusValue)
    : null;
  const categoryId = String(params.category ?? "").trim();
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const baseWhere: Prisma.BlogPostWhereInput = {
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
            { seoTitle: { contains: q, mode: "insensitive" } },
            {
              category: {
                name: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const where: Prisma.BlogPostWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.blogPost.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [posts, categories, published, drafts, scheduled] = await Promise.all([
    db.blogPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { category: { select: { name: true } } },
      skip,
      take: PAGE_SIZE,
    }),
    db.blogCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.blogPost.count({ where: { ...baseWhere, status: "PUBLISHED" } }),
    db.blogPost.count({
      where: { ...baseWhere, status: { in: ["DRAFT", "REVIEW"] } },
    }),
    db.blogPost.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
  ]);

  const rows = posts.map((post) => [
    <Link key={post.id} href={`/admin/content/blog/${post.id}`}>
      {post.title}
    </Link>,
    post.category?.name ?? "Uncategorized",
    post.slug,
    post.seoTitle ? "SEO ready" : "SEO missing",
    <StatusPill key={post.id} tone={tone(post.status)}>
      {post.status.replaceAll("_", " ")}
    </StatusPill>,
    post.publishedAt?.toLocaleDateString("en-IN") ?? "—",
    post.updatedAt.toLocaleDateString("en-IN"),
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (categoryId) next.set("category", categoryId);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/blog?${query}` : "/admin/blog";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + posts.length, total);
  const selectedCategory =
    categories.find((category) => category.id === categoryId)?.name ?? null;

  return (
    <AdminTablePage
      active="Blog"
      title="Blog Posts"
      subtitle="Live travel stories and editorial content from Neon."
      actions={
        hasPermission(session.roles, "content.write") ? (
          <div>
            <Link className="admin-secondary-button" href="/admin/blog/categories">
              Categories
            </Link>
            <Link className="admin-primary-button" href="/admin/blog/new">
              ＋ New Blog Post
            </Link>
          </div>
        ) : null
      }
      metrics={[
        {
          label: "Matching Posts",
          value: total.toString(),
          meta: "current filters",
          tone: "orange",
        },
        {
          label: "Published",
          value: published.toString(),
          meta: "current search/category",
          tone: "green",
        },
        {
          label: "Draft / Review",
          value: drafts.toString(),
          meta: "current search/category",
          tone: "orange",
        },
        {
          label: "Scheduled",
          value: scheduled.toString(),
          meta: "current search/category",
          tone: "blue",
        },
      ]}
      filters={[
        selectedCategory ?? "All categories",
        status ? status.replaceAll("_", " ") : "All statuses",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <label>
            <span>Search</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Title, slug, excerpt or category"
            />
          </label>

          <label>
            <span>Category</span>
            <select name="category" defaultValue={categoryId}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {contentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status || categoryId) ? (
            <Link className="admin-secondary-button" href="/admin/blog">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Title",
        "Category",
        "Slug",
        "SEO",
        "Status",
        "Published",
        "Updated",
      ]}
      rows={rows}
      footer={
        <>
          <span>
            Showing {firstShown}–{lastShown} of {total}
          </span>
          <div className="admin-table-pager">
            {safePage > 1 ? (
              <Link className="admin-secondary-button" href={pageHref(safePage - 1)}>
                ← Previous
              </Link>
            ) : null}
            <small>
              Page {safePage} of {totalPages}
            </small>
            {safePage < totalPages ? (
              <Link className="admin-secondary-button" href={pageHref(safePage + 1)}>
                Next →
              </Link>
            ) : null}
          </div>
        </>
      }
    />
  );
}
