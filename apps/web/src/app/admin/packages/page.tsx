import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";
import { contentStatuses } from "@/modules/content/admin-content-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  if (status === "SCHEDULED") return "blue";
  return "gray";
}

type ContentStatusValue = (typeof contentStatuses)[number];

function isContentStatus(value: string): value is ContentStatusValue {
  return (contentStatuses as readonly string[]).includes(value);
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "package.read")) redirect("/admin");

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

  const baseWhere: Prisma.TourPackageWhereInput = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.TourPackageWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.tourPackage.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [packages, published, drafts, scheduled] = await Promise.all([
    db.tourPackage.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        priceOptions: {
          where: { isActive: true },
          orderBy: { amountMinor: "asc" },
        },
        destinations: {
          include: { destination: { select: { name: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      skip,
      take: PAGE_SIZE,
    }),
    db.tourPackage.count({
      where: { ...baseWhere, status: "PUBLISHED" },
    }),
    db.tourPackage.count({
      where: { ...baseWhere, status: { in: ["DRAFT", "REVIEW"] } },
    }),
    db.tourPackage.count({
      where: { ...baseWhere, status: "SCHEDULED" },
    }),
  ]);

  const rows = packages.map((pkg) => {
    const firstPrice = pkg.priceOptions[0];

    return [
      <Link key={pkg.id} href={`/admin/packages/${pkg.id}`}>
        {pkg.title}
      </Link>,
      pkg.destinations.map((item) => item.destination.name).join(", ") || "—",
      `${pkg.durationDays}D / ${pkg.durationNights}N`,
      firstPrice
        ? `From ${money(firstPrice.amountMinor, firstPrice.currency)}`
        : "Quote only",
      <StatusPill key={pkg.id} tone={tone(pkg.status)}>
        {pkg.status.replaceAll("_", " ")}
      </StatusPill>,
      pkg.publishedAt?.toLocaleDateString("en-IN") ?? "—",
      pkg.slug,
    ];
  });

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/packages?${query}` : "/admin/packages";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + packages.length, total);

  return (
    <AdminTablePage
      active="Tours & Packages"
      title="Packages"
      subtitle="Live tour package catalog, pricing and publication state."
      actions={
        hasPermission(session.roles, "package.write") ? (
          <Link className="admin-primary-button" href="/admin/packages/new">
            ＋ New Package
          </Link>
        ) : null
      }
      metrics={[
        {
          label: "Matching Packages",
          value: total.toString(),
          meta: "current filters",
          tone: "orange",
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
          tone: "blue",
        },
        {
          label: "Scheduled",
          value: scheduled.toString(),
          meta: "current search",
          tone: "orange",
        },
      ]}
      filters={[
        status ? status.replaceAll("_", " ") : "All statuses",
        q ? `Search: ${q}` : "All packages",
      ]}
      toolbar={
        <form className="admin-table-query admin-table-query--compact" method="get">
          <label>
            <span>Search</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Package title, slug or summary"
            />
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

          {(q || status) ? (
            <Link className="admin-secondary-button" href="/admin/packages">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Package",
        "Destinations",
        "Duration",
        "Price",
        "Status",
        "Published",
        "Slug",
      ]}
      emptyTitle={
        q || status ? "No packages match these filters" : "No packages yet"
      }
      emptyMessage={
        q || status
          ? "Try clearing the search or status filter to broaden the package list."
          : "Create the first package draft to start building itinerary, pricing, media and SEO."
      }
      emptyAction={
        !q &&
        !status &&
        hasPermission(session.roles, "package.write") ? (
          <Link className="admin-primary-button" href="/admin/packages/new">
            ＋ Create First Package
          </Link>
        ) : null
      }
      rows={rows}
      footer={
        <>
          <span>
            Showing {firstShown}–{lastShown} of {total}
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
        </>
      }
    />
  );
}
