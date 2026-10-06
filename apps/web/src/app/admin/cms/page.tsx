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

export default async function CmsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const [pages, total, published, drafts, scheduled] = await Promise.all([
    db.cmsPage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.cmsPage.count(),
    db.cmsPage.count({ where: { status: "PUBLISHED" } }),
    db.cmsPage.count({ where: { status: { in: ["DRAFT", "REVIEW"] } } }),
    db.cmsPage.count({ where: { status: "SCHEDULED" } }),
  ]);

  const rows = pages.map((page) => [
    <Link key={page.id} href={`/admin/content/cms/${page.id}`}>
      {page.title}
    </Link>,
    page.slug === "/" ? "/" : `/${page.slug.replace(/^\//, "")}`,
    page.seoTitle ? "SEO ready" : "SEO missing",
    page.robotsIndex ? "Index" : "Noindex",
    <StatusPill key={page.id} tone={tone(page.status)}>
      {page.status.replaceAll("_", " ")}
    </StatusPill>,
    page.publishedAt?.toLocaleDateString("en-IN") ?? "—",
    page.updatedAt.toLocaleDateString("en-IN"),
  ]);

  return (
    <AdminTablePage
      active="CMS Pages"
      title="CMS Pages"
      subtitle="Live website pages and publication state from Neon."
      actions={
        hasPermission(session.roles, "content.write") ? (
          <Link className="admin-primary-button" href="/admin/cms/new">
            ＋ New CMS Page
          </Link>
        ) : null
      }
      metrics={[
        { label: "All Pages", value: total.toString(), meta: "all records", tone: "blue" },
        { label: "Published", value: published.toString(), meta: "visible publicly", tone: "green" },
        { label: "Draft / Review", value: drafts.toString(), meta: "work in progress", tone: "orange" },
        { label: "Scheduled", value: scheduled.toString(), meta: "future publish", tone: "blue" },
      ]}
      filters={["Latest 100"]}
      columns={["Page Title", "Slug", "SEO", "Indexing", "Status", "Published", "Updated"]}
      rows={rows}
    />
  );
}
