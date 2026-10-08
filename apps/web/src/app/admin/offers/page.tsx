import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import {
  isPricingRuleStatus,
  isTripType,
  pricingRuleStatuses,
  tripTypes,
} from "@/modules/pricing/pricing-rule-management-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type PricingRuleStatusValue = (typeof pricingRuleStatuses)[number];
type TripTypeValue = (typeof tripTypes)[number];

function money(minor: bigint | null, currency: string): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  if (status === "INACTIVE") return "gray";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    tripType?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isPricingRuleStatus(String(params.status ?? ""))
    ? (String(params.status) as PricingRuleStatusValue)
    : null;
  const tripType = isTripType(String(params.tripType ?? ""))
    ? (String(params.tripType) as TripTypeValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();
  const now = new Date();

  const baseWhere: Prisma.PricingRuleWhereInput = {
    ...(tripType ? { tripType } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { originKey: { contains: q, mode: "insensitive" } },
            { destinationKey: { contains: q, mode: "insensitive" } },
            {
              vehicleClass: {
                name: { contains: q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const where: Prisma.PricingRuleWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.pricingRule.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [rules, active, drafts, expiredActive] = await Promise.all([
    db.pricingRule.findMany({
      where,
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      include: {
        vehicleClass: { select: { name: true } },
      },
      skip,
      take: PAGE_SIZE,
    }),
    db.pricingRule.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    db.pricingRule.count({ where: { ...baseWhere, status: "DRAFT" } }),
    db.pricingRule.count({
      where: {
        ...baseWhere,
        status: "ACTIVE",
        activeTo: { lt: now },
      },
    }),
  ]);

  const rows = rules.map((rule) => [
    <Link key={rule.id} href={`/admin/offers/${rule.id}`}>
      {rule.name}
    </Link>,
    rule.vehicleClass.name,
    rule.tripType.replaceAll("_", " "),
    rule.basis.replaceAll("_", " "),
    rule.basis === "FIXED"
      ? money(rule.baseAmountMinor, rule.currency)
      : rule.basis === "PER_KM"
        ? `${money(rule.perKmMinor, rule.currency)} / km`
        : "Quote only",
    rule.activeFrom?.toLocaleDateString("en-IN") ?? "Immediate",
    rule.activeTo?.toLocaleDateString("en-IN") ?? "No expiry",
    <StatusPill key={rule.id} tone={tone(rule.status)}>
      {rule.status.replaceAll("_", " ")}
    </StatusPill>,
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (tripType) next.set("tripType", tripType);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/offers?${query}` : "/admin/offers";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + rules.length, total);

  return (
    <AdminTablePage
      active="Offers"
      title="Pricing Rules / Offers"
      subtitle="Live server-side pricing rules. Coupon codes are not enabled until a dedicated promotion engine is implemented."
      actions={
        hasPermission(session.roles, "settings.manage") ? (
          <Link className="admin-primary-button" href="/admin/offers/new">
            ＋ New Pricing Rule
          </Link>
        ) : null
      }
      metrics={[
        {
          label: "Matching Rules",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Active Rules",
          value: active.toString(),
          meta: "current search/trip type",
          tone: "green",
        },
        {
          label: "Draft Rules",
          value: drafts.toString(),
          meta: "current search/trip type",
          tone: "orange",
        },
        {
          label: "Expired Active",
          value: expiredActive.toString(),
          meta: "requires review",
          tone: expiredActive ? "red" : "green",
        },
      ]}
      filters={[
        tripType ? tripType.replaceAll("_", " ") : "All trip types",
        status ? status.replaceAll("_", " ") : "All statuses",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="pricingSearch">
            <input
              id="pricingSearch"
              name="q"
              defaultValue={q}
              placeholder="Rule name, route scope or vehicle class"
            />
          </AdminField>

          <AdminField label="Trip type" htmlFor="pricingTripType">
            <select id="pricingTripType" name="tripType" defaultValue={tripType ?? ""}>
              <option value="">All trip types</option>
              {tripTypes.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Status" htmlFor="pricingStatus">
            <select id="pricingStatus" name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {pricingRuleStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status || tripType) ? (
            <Link className="admin-secondary-button" href="/admin/offers">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Rule",
        "Vehicle Class",
        "Trip Type",
        "Basis",
        "Rate",
        "Starts",
        "Ends",
        "Status",
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
