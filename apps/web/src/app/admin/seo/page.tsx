import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SeoRow = {
  id: string;
  type: "CMS" | "Blog" | "Destination" | "Package";
  title: string;
  slug: string;
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  updatedAt: Date;
};

function score(row: SeoRow): number {
  let value = 0;
  if (row.seoTitle && row.seoTitle.trim().length >= 20) value += 25;
  if (row.seoDescription && row.seoDescription.trim().length >= 70) value += 25;
  if (row.canonicalUrl) value += 15;
  if (row.robotsIndex) value += 15;
  if (row.status === "PUBLISHED") value += 20;
  return value;
}

function scoreTone(value: number): "green" | "orange" | "red" | "blue" | "gray" {
  if (value >= 80) return "green";
  if (value >= 50) return "orange";
  return "red";
}

function editHref(row: SeoRow): string {
  if (row.type === "Package") return `/admin/packages/${row.id}?tab=publishing`;
  return `/admin/content/${row.type.toLowerCase()}/${row.id}?tab=publishing`;
}

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    indexing?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "seo.manage")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const type = ["CMS", "Blog", "Destination", "Package"].includes(
    String(params.type ?? ""),
  )
    ? String(params.type)
    : "ALL";
  const indexing =
    params.indexing === "INDEX" || params.indexing === "NOINDEX"
      ? params.indexing
      : "ALL";
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  async function saveRedirect(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "seo.manage")) redirect("/admin");

    const sourcePath = String(formData.get("sourcePath") ?? "").trim();
    const destinationPath = String(formData.get("destinationPath") ?? "").trim();
    const statusCode = Number(formData.get("statusCode") ?? 301);

    if (
      !sourcePath.startsWith("/") ||
      sourcePath.startsWith("//") ||
      sourcePath.length > 500
    ) {
      throw new Error("Source path must be a same-origin path beginning with /.");
    }

    if (
      !destinationPath.startsWith("/") ||
      destinationPath.startsWith("//") ||
      destinationPath.length > 500
    ) {
      throw new Error("Destination path must be a same-origin path beginning with /.");
    }

    if (sourcePath === destinationPath) {
      throw new Error("Source and destination paths must be different.");
    }

    if (![301, 302, 307, 308].includes(statusCode)) {
      throw new Error("Unsupported redirect status code.");
    }

    const item = await db.seoRedirect.upsert({
      where: { sourcePath },
      update: {
        destinationPath,
        statusCode,
        isActive: true,
      },
      create: {
        sourcePath,
        destinationPath,
        statusCode,
        isActive: true,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: "SEO_REDIRECT_SAVED",
        entityType: "SeoRedirect",
        entityId: item.id,
        metadata: { sourcePath, destinationPath, statusCode },
      },
    });

    revalidatePath("/admin/seo");
  }

  async function toggleRedirect(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "seo.manage")) redirect("/admin");

    const id = String(formData.get("id") ?? "");
    const isActive = String(formData.get("isActive") ?? "") === "true";

    const item = await db.seoRedirect.update({
      where: { id },
      data: { isActive: !isActive },
    });

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: item.isActive ? "SEO_REDIRECT_ENABLED" : "SEO_REDIRECT_DISABLED",
        entityType: "SeoRedirect",
        entityId: item.id,
        metadata: { sourcePath: item.sourcePath },
      },
    });

    revalidatePath("/admin/seo");
  }

  const indexFilter =
    indexing === "INDEX"
      ? { robotsIndex: true }
      : indexing === "NOINDEX"
        ? { robotsIndex: false }
        : {};

  const cmsWhere: Prisma.CmsPageWhereInput = {
    ...indexFilter,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { seoTitle: { contains: q, mode: "insensitive" } },
            { seoDescription: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const blogWhere: Prisma.BlogPostWhereInput = {
    ...indexFilter,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { seoTitle: { contains: q, mode: "insensitive" } },
            { seoDescription: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const destinationWhere: Prisma.DestinationWhereInput = {
    ...indexFilter,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { seoTitle: { contains: q, mode: "insensitive" } },
            { seoDescription: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const packageWhere: Prisma.TourPackageWhereInput = {
    ...indexFilter,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { seoTitle: { contains: q, mode: "insensitive" } },
            { seoDescription: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const fetchLimit = page * PAGE_SIZE;

  const [
    pages,
    posts,
    destinations,
    packages,
    pageCount,
    postCount,
    destinationCount,
    packageCount,
    redirects,
    totalTracked,
    missingTitle,
    missingDescription,
    noindex,
  ] = await Promise.all([
    type !== "ALL" && type !== "CMS"
      ? Promise.resolve([])
      : db.cmsPage.findMany({
          where: cmsWhere,
          orderBy: { updatedAt: "desc" },
          take: fetchLimit,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            updatedAt: true,
          },
        }),
    type !== "ALL" && type !== "Blog"
      ? Promise.resolve([])
      : db.blogPost.findMany({
          where: blogWhere,
          orderBy: { updatedAt: "desc" },
          take: fetchLimit,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            updatedAt: true,
          },
        }),
    type !== "ALL" && type !== "Destination"
      ? Promise.resolve([])
      : db.destination.findMany({
          where: destinationWhere,
          orderBy: { updatedAt: "desc" },
          take: fetchLimit,
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            updatedAt: true,
          },
        }),
    type !== "ALL" && type !== "Package"
      ? Promise.resolve([])
      : db.tourPackage.findMany({
          where: packageWhere,
          orderBy: { updatedAt: "desc" },
          take: fetchLimit,
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            updatedAt: true,
          },
        }),
    type !== "ALL" && type !== "CMS"
      ? Promise.resolve(0)
      : db.cmsPage.count({ where: cmsWhere }),
    type !== "ALL" && type !== "Blog"
      ? Promise.resolve(0)
      : db.blogPost.count({ where: blogWhere }),
    type !== "ALL" && type !== "Destination"
      ? Promise.resolve(0)
      : db.destination.count({ where: destinationWhere }),
    type !== "ALL" && type !== "Package"
      ? Promise.resolve(0)
      : db.tourPackage.count({ where: packageWhere }),
    db.seoRedirect.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    Promise.all([
      db.cmsPage.count(),
      db.blogPost.count(),
      db.destination.count(),
      db.tourPackage.count(),
    ]).then((counts) => counts.reduce((sum, value) => sum + value, 0)),
    Promise.all([
      db.cmsPage.count({ where: { seoTitle: null } }),
      db.blogPost.count({ where: { seoTitle: null } }),
      db.destination.count({ where: { seoTitle: null } }),
      db.tourPackage.count({ where: { seoTitle: null } }),
    ]).then((counts) => counts.reduce((sum, value) => sum + value, 0)),
    Promise.all([
      db.cmsPage.count({ where: { seoDescription: null } }),
      db.blogPost.count({ where: { seoDescription: null } }),
      db.destination.count({ where: { seoDescription: null } }),
      db.tourPackage.count({ where: { seoDescription: null } }),
    ]).then((counts) => counts.reduce((sum, value) => sum + value, 0)),
    Promise.all([
      db.cmsPage.count({ where: { robotsIndex: false } }),
      db.blogPost.count({ where: { robotsIndex: false } }),
      db.destination.count({ where: { robotsIndex: false } }),
      db.tourPackage.count({ where: { robotsIndex: false } }),
    ]).then((counts) => counts.reduce((sum, value) => sum + value, 0)),
  ]);

  const combined: SeoRow[] = [
    ...pages.map((item) => ({ type: "CMS" as const, ...item })),
    ...posts.map((item) => ({ type: "Blog" as const, ...item })),
    ...destinations.map((item) => ({
      type: "Destination" as const,
      id: item.id,
      title: item.name,
      slug: item.slug,
      status: item.status,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      canonicalUrl: item.canonicalUrl,
      robotsIndex: item.robotsIndex,
      updatedAt: item.updatedAt,
    })),
    ...packages.map((item) => ({ type: "Package" as const, ...item })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const matchingCount = pageCount + postCount + destinationCount + packageCount;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageRows = combined.slice(offset, offset + PAGE_SIZE);
  const scored = pageRows.map((row) => ({ row, score: score(row) }));
  const strongOnPage = scored.filter((item) => item.score >= 80).length;

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (type !== "ALL") next.set("type", type);
    if (indexing !== "ALL") next.set("indexing", indexing);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/seo?${query}` : "/admin/seo";
  }

  const firstShown = matchingCount === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + pageRows.length, matchingCount);

  return (
    <AdminShell
      active="SEO Manager"
      title="SEO Manager"
      subtitle="Live metadata health, editor links and redirect configuration from Neon."
    >
      <div className="admin-metric-grid">
        <AdminMetric
          label="Tracked Content"
          value={totalTracked.toString()}
          meta="CMS + blog + destinations + packages"
          tone="blue"
        />
        <AdminMetric
          label="Strong SEO"
          value={strongOnPage.toString()}
          meta="score 80+ on current page"
          tone="green"
        />
        <AdminMetric
          label="Missing Titles"
          value={missingTitle.toString()}
          meta="all tracked content"
          tone="orange"
        />
        <AdminMetric
          label="Missing Descriptions"
          value={missingDescription.toString()}
          meta={`${noindex} noindex items`}
          tone="orange"
        />
      </div>

      <section className="admin-panel">
        <div className="admin-table-toolbar">
          <form className="admin-table-query" method="get">
            <label>
              <span>Search</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Title, slug or SEO metadata"
              />
            </label>

            <label>
              <span>Type</span>
              <select name="type" defaultValue={type}>
                <option value="ALL">All types</option>
                <option value="CMS">CMS</option>
                <option value="Blog">Blog</option>
                <option value="Destination">Destination</option>
                <option value="Package">Package</option>
              </select>
            </label>

            <label>
              <span>Indexing</span>
              <select name="indexing" defaultValue={indexing}>
                <option value="ALL">All</option>
                <option value="INDEX">Index</option>
                <option value="NOINDEX">Noindex</option>
              </select>
            </label>

            <button className="admin-primary-button" type="submit">
              Apply
            </button>

            {(q || type !== "ALL" || indexing !== "ALL") ? (
              <Link className="admin-secondary-button" href="/admin/seo">
                Reset
              </Link>
            ) : null}
          </form>
        </div>

        <div className="admin-panel-heading">
          <div>
            <h2>Content SEO Health</h2>
            <p>
              Showing {firstShown}–{lastShown} of {matchingCount} matching items.
            </p>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <div className="admin-table-empty">
            <strong>No SEO records match these filters</strong>
            <p>Change the search, type or indexing filter and try again.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Content</th>
                  <th>Slug</th>
                  <th>SEO Score</th>
                  <th>Indexing</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {scored.map(({ row, score: rowScore }) => (
                  <tr key={`${row.type}-${row.id}`}>
                    <td>{row.type}</td>
                    <td>{row.title}</td>
                    <td>{row.slug}</td>
                    <td>
                      <StatusPill tone={scoreTone(rowScore)}>
                        {rowScore}/100
                      </StatusPill>
                    </td>
                    <td>{row.robotsIndex ? "Index" : "Noindex"}</td>
                    <td>{row.updatedAt.toLocaleDateString("en-IN")}</td>
                    <td>
                      <Link href={editHref(row)}>Edit SEO</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-table-footer">
          <span>
            Showing {firstShown}–{lastShown} of {matchingCount}
          </span>
          <div className="admin-table-pager">
            {safePage > 1 ? (
              <Link
                className="admin-secondary-button"
                href={pageHref(safePage - 1)}
              >
                ← Previous
              </Link>
            ) : null}
            <small>
              Page {safePage} of {totalPages}
            </small>
            {safePage < totalPages ? (
              <Link
                className="admin-secondary-button"
                href={pageHref(safePage + 1)}
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="admin-panel admin-detail-card">
        <div className="admin-panel-heading">
          <div>
            <h2>Redirects</h2>
            <p>Manage same-origin redirects without exposing deployment configuration.</p>
          </div>
          <span>{redirects.length} loaded</span>
        </div>

        <form action={saveRedirect}>
          <AdminFormGrid columns={3}>
            <AdminField
              label="Source path"
              htmlFor="sourcePath"
              required
              hint="Must start with / and must not equal the destination."
            >
              <input
                id="sourcePath"
                name="sourcePath"
                required
                placeholder="/old-page"
                maxLength={500}
              />
            </AdminField>

            <AdminField
              label="Destination path"
              htmlFor="destinationPath"
              required
            >
              <input
                id="destinationPath"
                name="destinationPath"
                required
                placeholder="/new-page"
                maxLength={500}
              />
            </AdminField>

            <AdminField label="Status code" htmlFor="statusCode" required>
              <select id="statusCode" name="statusCode" defaultValue="301">
                <option value="301">301 Permanent</option>
                <option value="302">302 Temporary</option>
                <option value="307">307 Temporary</option>
                <option value="308">308 Permanent</option>
              </select>
            </AdminField>
          </AdminFormGrid>

          <button className="admin-primary-button" type="submit">
            Save Redirect
          </button>
        </form>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Destination</th>
                <th>Code</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {redirects.length === 0 ? (
                <tr>
                  <td colSpan={5}>No redirects configured.</td>
                </tr>
              ) : (
                redirects.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sourcePath}</td>
                    <td>{item.destinationPath}</td>
                    <td>{item.statusCode}</td>
                    <td>{item.isActive ? "Active" : "Disabled"}</td>
                    <td>
                      <form action={toggleRedirect}>
                        <input type="hidden" name="id" value={item.id}/>
                        <input
                          type="hidden"
                          name="isActive"
                          value={item.isActive ? "true" : "false"}
                        />
                        <button className="admin-secondary-button" type="submit">
                          {item.isActive ? "Disable" : "Enable"}
                        </button>
                      </form>
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
