import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

export default async function BlogPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const [posts, total, published, drafts, scheduled] = await Promise.all([
    db.blogPost.findMany({
      orderBy: { updatedAt: "desc" },
      include: { category: { select: { name: true } } },
      take: 100,
    }),
    db.blogPost.count(),
    db.blogPost.count({ where: { status: "PUBLISHED" } }),
    db.blogPost.count({ where: { status: { in: ["DRAFT", "REVIEW"] } } }),
    db.blogPost.count({ where: { status: "SCHEDULED" } }),
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

  return (
    <AdminTablePage
      active="Blog"
      title="Blog Posts"
      subtitle="Live travel stories and editorial content from Neon."
      actions={
        hasPermission(session.roles, "content.write") ? (
          <Link className="admin-primary-button" href="/admin/blog/new">
            ＋ New Blog Post
          </Link>
        ) : null
      }
      metrics={[
        { label: "All Posts", value: total.toString(), meta: "all records", tone: "orange" },
        { label: "Published", value: published.toString(), meta: "live articles", tone: "green" },
        { label: "Draft / Review", value: drafts.toString(), meta: "work in progress", tone: "orange" },
        { label: "Scheduled", value: scheduled.toString(), meta: "future publish", tone: "blue" },
      ]}
      filters={["Latest 100"]}
      columns={["Title", "Category", "Slug", "SEO", "Status", "Published", "Updated"]}
      rows={rows}
    />
  );
}
