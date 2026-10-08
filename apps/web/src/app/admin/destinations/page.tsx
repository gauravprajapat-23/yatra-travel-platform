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
const destinationKinds = ["CITY", "TEMPLE", "NATURE", "HERITAGE", "REGION"] as const;
type DestinationKindValue = (typeof destinationKinds)[number];
type ContentStatusValue = (typeof contentStatuses)[number];

function isDestinationKind(value: string): value is DestinationKindValue {
  return (destinationKinds as readonly string[]).includes(value);
}

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

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    status?: string;
    featured?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const kind = isDestinationKind(String(params.kind ?? ""))
    ? (String(params.kind) as DestinationKindValue)
    : null;
  const status = isContentStatus(String(params.status ?? ""))
    ? (String(params.status) as ContentStatusValue)
    : null;
  const featured =
    params.featured === "YES"
      ? true
      : params.featured === "NO"
        ? false
        : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const baseWhere: Prisma.DestinationWhereInput = {
    ...(kind ? { kind } : {}),
    ...(featured === null ? {} : { isFeatured: featured }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { summary: { contains: q, mode: "insensitive" } },
            { seoTitle: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const where: Prisma.DestinationWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.destination.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [destinations, published, drafts, featuredCount] = await Promise.all([
    db.destination.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.destination.count({ where: { ...baseWhere, status: "PUBLISHED" } }),
    db.destination.count({
      where: { ...baseWhere, status: { in: ["DRAFT", "REVIEW"] } },
    }),
    db.destination.count({
      where: { ...baseWhere, isFeatured: true },
    }),
  ]);

  const rows = destinations.map((destination) => [
    <Link
      key={destination.id}
      href={`/admin/content/destination/${destination.id}`}
    >
      {destination.name}
    </Link>,
    destination.slug,
    destination.kind.replaceAll("_", " "),
    destination.isFeatured ? "Featured" : "—",
    destination.seoTitle ? "SEO ready" : "SEO missing",
    <StatusPill key={destination.id} tone={tone(destination.status)}>
      {destination.status.replaceAll("_", " ")}
    </StatusPill>,
    destination.updatedAt.toLocaleDateString("en-IN"),
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (kind) next.set("kind", kind);
    if (status) next.set("status", status);
    if (featured !== null) next.set("featured", featured ? "YES" : "NO");
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query
      ? `/admin/destinations?${query}`
      : "/admin/destinations";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + destinations.length, total);

  return (
    <AdminTablePage
      active="Destinations"
      title="Destinations"
      subtitle="Live destination content and publication state from Neon."
      actions={
        hasPermission(session.roles, "content.write") ? (
          <Link className="admin-primary-button" href="/admin/destinations/new">
            ＋ New Destination
          </Link>
        ) : null
      }
      metrics={[
        {
          label: "Matching Destinations",
          value: total.toString(),
          meta: "current filters",
          tone: "green",
        },
        {
          label: "Published",
          value: published.toString(),
          meta: "current search/kind",
          tone: "green",
        },
        {
          label: "Draft / Review",
          value: drafts.toString(),
          meta: "current search/kind",
          tone: "orange",
        },
        {
          label: "Featured",
          value: featuredCount.toString(),
          meta: "current search/kind",
          tone: "blue",
        },
      ]}
      filters={[
        kind ? kind.replaceAll("_", " ") : "All kinds",
        status ? status.replaceAll("_", " ") : "All statuses",
        featured === null ? "Featured + standard" : featured ? "Featured only" : "Standard only",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="destinationSearch">
            <input
              id="destinationSearch"
              name="q"
              defaultValue={q}
              placeholder="Destination name, slug or summary"
            />
          </AdminField>

          <AdminField label="Kind" htmlFor="destinationKind">
            <select id="destinationKind" name="kind" defaultValue={kind ?? ""}>
              <option value="">All kinds</option>
              {destinationKinds.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Status" htmlFor="destinationStatus">
            <select id="destinationStatus" name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {contentStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Featured" htmlFor="destinationFeatured">
            <select
              id="destinationFeatured"
              name="featured"
              defaultValue={featured === null ? "" : featured ? "YES" : "NO"}
            >
              <option value="">All</option>
              <option value="YES">Featured</option>
              <option value="NO">Standard</option>
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || kind || status || featured !== null) ? (
            <Link className="admin-secondary-button" href="/admin/destinations">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Destination",
        "Slug",
        "Kind",
        "Featured",
        "SEO",
        "Status",
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
