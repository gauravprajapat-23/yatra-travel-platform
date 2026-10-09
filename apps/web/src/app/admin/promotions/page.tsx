import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate } from "@/lib/admin/datetime";
import {
  isPromotionScope,
  isPromotionStatus,
  promotionStatuses,
} from "@/modules/promotions/promotion-management-service";
import { promotionScopes } from "@yatra/domain/promotions/discount";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

function money(minor: bigint | null, currency: string | null): string {
  if (minor === null || !currency) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    scope?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isPromotionStatus(String(params.status ?? ""))
    ? String(params.status)
    : "";
  const scope = isPromotionScope(String(params.scope ?? ""))
    ? String(params.scope)
    : "";
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const baseWhere: Prisma.PromotionWhereInput = {
    ...(scope ? { scope: scope as never } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const where: Prisma.PromotionWhereInput = {
    ...baseWhere,
    ...(status ? { status: status as never } : {}),
  };

  const db = getDb();
  const total = await db.promotion.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [promotions, active, drafts, exhausted] = await Promise.all([
    db.promotion.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.promotion.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    db.promotion.count({ where: { ...baseWhere, status: "DRAFT" } }),
    db.promotion.count({
      where: {
        ...baseWhere,
        maxRedemptions: { not: null },
        redeemedCount: { gt: 0 },
        AND: [
          {
            OR: [
              { status: "ACTIVE" },
              { status: "INACTIVE" },
            ],
          },
        ],
      },
    }),
  ]);

  const rows = promotions.map((promotion) => {
    const value =
      promotion.discountKind === "PERCENTAGE"
        ? `${((promotion.percentageBps ?? 0) / 100).toFixed(2)}%`
        : money(promotion.fixedAmountMinor, promotion.currency);

    return [
      <Link key={promotion.id} href={`/admin/promotions/${promotion.id}`}>
        <strong>{promotion.code}</strong>
        <br />
        <small>{promotion.name}</small>
      </Link>,
      promotion.scope,
      promotion.discountKind.replaceAll("_", " "),
      value,
      promotion.minSubtotalMinor !== null
        ? money(promotion.minSubtotalMinor, promotion.currency ?? "INR")
        : "None",
      promotion.maxRedemptions === null
        ? `${promotion.redeemedCount} / Unlimited`
        : `${promotion.redeemedCount} / ${promotion.maxRedemptions}`,
      promotion.activeFrom ? formatIstDate(promotion.activeFrom) : "Immediate",
      promotion.activeTo ? formatIstDate(promotion.activeTo) : "No expiry",
      <StatusPill key={`${promotion.id}-status`} tone={tone(promotion.status)}>
        {promotion.status}
      </StatusPill>,
    ];
  });

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (scope) next.set("scope", scope);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/promotions?${query}` : "/admin/promotions";
  }

  return (
    <AdminTablePage
      active="Promotions"
      title="Promotions"
      subtitle="Configure coupon codes and discount rules. Quote application remains gated until redemption concurrency is certified."
      actions={
        <Link className="admin-primary-button" href="/admin/promotions/new">
          ＋ New Promotion
        </Link>
      }
      metrics={[
        { label: "Matching", value: total.toString(), meta: "current filters", tone: "blue" },
        { label: "Active", value: active.toString(), meta: "available configurations", tone: "green" },
        { label: "Drafts", value: drafts.toString(), meta: "not customer-visible", tone: "orange" },
        { label: "With Usage", value: exhausted.toString(), meta: "limited promotions already redeemed", tone: "blue" },
      ]}
      filters={[
        status || "All statuses",
        scope || "All scopes",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="promotionSearch">
            <input
              id="promotionSearch"
              name="q"
              defaultValue={q}
              placeholder="Code, name or description"
            />
          </AdminField>
          <AdminField label="Scope" htmlFor="promotionScope">
            <select id="promotionScope" name="scope" defaultValue={scope}>
              <option value="">All scopes</option>
              {promotionScopes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Status" htmlFor="promotionStatus">
            <select id="promotionStatus" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {promotionStatuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </AdminField>
          <button className="admin-primary-button" type="submit">Apply</button>
          {(q || status || scope) ? (
            <Link className="admin-secondary-button" href="/admin/promotions">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Code",
        "Scope",
        "Discount",
        "Value",
        "Minimum",
        "Usage",
        "Starts",
        "Ends",
        "Status",
      ]}
      rows={rows}
      footer={
        <>
          <span>
            Showing {total === 0 ? 0 : skip + 1}–{Math.min(skip + rows.length, total)} of {total}
          </span>
          <div className="admin-table-pager">
            {safePage > 1 ? (
              <Link className="admin-secondary-button" href={pageHref(safePage - 1)}>
                ← Previous
              </Link>
            ) : null}
            <small>Page {safePage} of {totalPages}</small>
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
