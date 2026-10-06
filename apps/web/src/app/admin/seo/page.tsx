import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type SeoRow = {
  type: string;
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

export default async function SeoPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "seo.manage")) redirect("/admin");

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

  const [pages, posts, destinations, packages, redirects] = await Promise.all([
    db.cmsPage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
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
    db.blogPost.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
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
    db.destination.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
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
    db.tourPackage.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
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
    db.seoRedirect.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const rows: SeoRow[] = [
    ...pages.map((item) => ({ type: "CMS", ...item })),
    ...posts.map((item) => ({ type: "Blog", ...item })),
    ...destinations.map((item) => ({
      type: "Destination",
      title: item.name,
      slug: item.slug,
      status: item.status,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      canonicalUrl: item.canonicalUrl,
      robotsIndex: item.robotsIndex,
      updatedAt: item.updatedAt,
    })),
    ...packages.map((item) => ({ type: "Package", ...item })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const scored = rows.map((row) => ({ row, score: score(row) }));
  const missingTitle = rows.filter((row) => !row.seoTitle).length;
  const missingDescription = rows.filter((row) => !row.seoDescription).length;
  const noindex = rows.filter((row) => !row.robotsIndex).length;
  const strong = scored.filter((item) => item.score >= 80).length;

  return (
    <AdminShell
      active="SEO Manager"
      title="SEO Manager"
      subtitle="Live SEO metadata health and redirect configuration from Neon."
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Tracked Content" value={rows.length.toString()} meta="CMS + blog + destinations + packages" tone="blue"/>
        <AdminMetric label="Strong SEO" value={strong.toString()} meta="score 80+" tone="green"/>
        <AdminMetric label="Missing Titles" value={missingTitle.toString()} meta="needs metadata" tone="orange"/>
        <AdminMetric label="Missing Descriptions" value={missingDescription.toString()} meta={`${noindex} noindex items`} tone="orange"/>
      </div>

      <div className="admin-report-bottom">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Content SEO Health</h2>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Content</th>
                <th>Slug</th>
                <th>SEO Score</th>
                <th>Indexing</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {scored.slice(0, 100).map(({ row, score: rowScore }) => (
                <tr key={`${row.type}-${row.slug}`}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Redirects</h2>
          </div>

          <form action={saveRedirect} className="admin-card-body">
            <label>
              Source path
              <input name="sourcePath" required placeholder="/old-page" maxLength={500}/>
            </label>
            <label>
              Destination path
              <input name="destinationPath" required placeholder="/new-page" maxLength={500}/>
            </label>
            <label>
              Status code
              <select name="statusCode" defaultValue="301">
                <option value="301">301 Permanent</option>
                <option value="302">302 Temporary</option>
                <option value="307">307 Temporary</option>
                <option value="308">308 Permanent</option>
              </select>
            </label>
            <button className="admin-primary-button" type="submit">
              Save Redirect
            </button>
          </form>

          <table className="admin-table">
            <thead>
              <tr><th>Source</th><th>Destination</th><th>Code</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {redirects.length === 0 ? (
                <tr><td colSpan={5}>No redirects configured.</td></tr>
              ) : redirects.map((item) => (
                <tr key={item.id}>
                  <td>{item.sourcePath}</td>
                  <td>{item.destinationPath}</td>
                  <td>{item.statusCode}</td>
                  <td>{item.isActive ? "Active" : "Disabled"}</td>
                  <td>
                    <form action={toggleRedirect}>
                      <input type="hidden" name="id" value={item.id}/>
                      <input type="hidden" name="isActive" value={item.isActive ? "true" : "false"}/>
                      <button className="admin-secondary-button" type="submit">
                        {item.isActive ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </AdminShell>
  );
}
