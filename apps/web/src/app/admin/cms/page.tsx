import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
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

export default async function CmsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isContentStatus(String(params.status ?? ""))
    ? (String(params.status) as ContentStatusValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const baseWhere: Prisma.CmsPageWhereInput = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { seoTitle: { contains: q, mode: "insensitive" } },
          { seoDescription: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.CmsPageWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.cmsPage.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [pages, published, drafts, scheduled] = await Promise.all([
    db.cmsPage.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.cmsPage.count({ where: { ...baseWhere, status: "PUBLISHED" } }),
    db.cmsPage.count({
      where: { ...baseWhere, status: { in: ["DRAFT", "REVIEW"] } },
    }),
    db.cmsPage.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
  ]);

  const rows = pages.map((pageRecord) => [
    <Link key={pageRecord.id} href={`/admin/content/cms/${pageRecord.id}`}>
      {pageRecord.title}
    </Link>,
    pageRecord.slug === "/"
      ? "/"
      : `/${pageRecord.slug.replace(/^\//, "")}`,
    pageRecord.seoTitle ? "SEO ready" : "SEO missing",
    pageRecord.robotsIndex ? "Index" : "Noindex",
    <StatusPill key={pageRecord.id} tone={tone(pageRecord.status)}>
      {pageRecord.status.replaceAll("_", " ")}
    </StatusPill>,
    pageRecord.publishedAt?.toLocaleDateString("en-IN") ?? "—",
    pageRecord.updatedAt.toLocaleDateString("en-IN"),
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/cms?${query}` : "/admin/cms";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + pages.length, total);

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
        {
          label: "Matching Pages",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Published",
          value: published.toString(),
          meta: "current search",
          tone: "green",
        },
        {
          label: "Draft / Review",
          value: drafts.toString(),
          meta: "current search",
          tone: "orange",
        },
        {
          label: "Scheduled",
          value: scheduled.toString(),
          meta: "current search",
          tone: "blue",
        },
      ]}
      filters={[
        status ? status.replaceAll("_", " ") : "All statuses",
        q ? `Search: ${q}` : "All CMS pages",
      ]}
      toolbar={
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Search" htmlFor="cmsSearch">
            <input
              id="cmsSearch"
              name="q"
              defaultValue={q}
              placeholder="Page title, slug or SEO metadata"
            />
          </AdminField>
          <AdminField label="Status" htmlFor="cmsStatus">
            <select id="cmsStatus" name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {contentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>
          <button className="admin-primary-button" type="submit">
            Apply
          </button>
          {(q || status) ? (
            <Link className="admin-secondary-button" href="/admin/cms">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Page Title",
        "Slug",
        "SEO",
        "Indexing",
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
