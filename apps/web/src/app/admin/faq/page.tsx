import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";
import {
  faqScopes,
  faqStatuses,
  isFaqScope,
  isFaqStatus,
} from "@/modules/content/faq-management-service";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type FaqScopeValue = (typeof faqScopes)[number];
type FaqStatusValue = (typeof faqStatuses)[number];

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  return "gray";
}

export default async function AdminFaqPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    scope?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const scope = isFaqScope(String(params.scope ?? ""))
    ? (String(params.scope) as FaqScopeValue)
    : null;
  const status = isFaqStatus(String(params.status ?? ""))
    ? (String(params.status) as FaqStatusValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const baseWhere: Prisma.FaqWhereInput = {
    ...(scope ? { scope } : {}),
    ...(q
      ? {
          OR: [
            { question: { contains: q, mode: "insensitive" } },
            { answer: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const where: Prisma.FaqWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.faq.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [faqs, published, drafts, scheduled] = await Promise.all([
    db.faq.findMany({
      where,
      orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      skip,
      take: PAGE_SIZE,
    }),
    db.faq.count({ where: { ...baseWhere, status: "PUBLISHED" } }),
    db.faq.count({
      where: { ...baseWhere, status: { in: ["DRAFT", "REVIEW"] } },
    }),
    db.faq.count({ where: { ...baseWhere, status: "SCHEDULED" } }),
  ]);

  const rows = faqs.map((faq) => [
    <Link key={faq.id} href={`/admin/faq/${faq.id}`}>
      {faq.question}
    </Link>,
    faq.scope.replaceAll("_", " "),
    faq.sortOrder.toString(),
    <StatusPill key={`${faq.id}-status`} tone={tone(faq.status)}>
      {faq.status.replaceAll("_", " ")}
    </StatusPill>,
    faq.publishedAt?.toLocaleString("en-IN") ?? "—",
    faq.updatedAt.toLocaleString("en-IN"),
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (scope) next.set("scope", scope);
    if (status) next.set("status", status);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/faq?${query}` : "/admin/faq";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + faqs.length, total);

  return (
    <AdminTablePage
      active="FAQs"
      title="FAQs"
      subtitle="Manage the published answers shown on the public FAQ page."
      actions={
        hasPermission(session.roles, "content.write") ? (
          <Link className="admin-primary-button" href="/admin/faq/new">
            ＋ New FAQ
          </Link>
        ) : null
      }
      metrics={[
        {
          label: "Matching FAQs",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Published",
          value: published.toString(),
          meta: "current search/scope",
          tone: "green",
        },
        {
          label: "Draft / Review",
          value: drafts.toString(),
          meta: "current search/scope",
          tone: "orange",
        },
        {
          label: "Scheduled",
          value: scheduled.toString(),
          meta: "current search/scope",
          tone: "blue",
        },
      ]}
      filters={[
        scope ? scope.replaceAll("_", " ") : "All scopes",
        status ? status.replaceAll("_", " ") : "All statuses",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <label>
            <span>Search</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Question or answer"
            />
          </label>

          <label>
            <span>Scope</span>
            <select name="scope" defaultValue={scope ?? ""}>
              <option value="">All scopes</option>
              {faqScopes.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {faqStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || scope || status) ? (
            <Link className="admin-secondary-button" href="/admin/faq">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Question",
        "Scope",
        "Sort",
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
