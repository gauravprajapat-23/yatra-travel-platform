import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate, formatIstDateTime } from "@/lib/admin/datetime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const sensitiveKeyPattern =
  /(secret|token|password|ciphertext|signature|authorization|credential|api[-_]?key)/i;

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    ).slice(0, 40)) {
      result[key] = sensitiveKeyPattern.test(key)
        ? "[redacted]"
        : sanitizeMetadata(entry, depth + 1);
    }
    return result;
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  return value;
}

function metadataText(value: unknown): string {
  if (value === null || value === undefined) return "—";

  try {
    const safe = sanitizeMetadata(value);
    const rendered = JSON.stringify(safe);
    return rendered.length > 900
      ? `${rendered.slice(0, 900)}…`
      : rendered;
  } catch {
    return "Unavailable";
  }
}

function parseDateStart(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateEnd(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "audit.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 160);
  const action = String(params.action ?? "").trim().slice(0, 120);
  const entityType = String(params.entityType ?? "").trim().slice(0, 120);
  const from = String(params.from ?? "").trim();
  const to = String(params.to ?? "").trim();
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { entityType: { contains: q, mode: "insensitive" } },
            { entityId: { contains: q, mode: "insensitive" } },
            { requestId: { contains: q, mode: "insensitive" } },
            {
              actor: {
                OR: [
                  { email: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const total = await db.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [events, actors, actionOptions, entityOptions] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        actor: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    db.auditLog.findMany({
      where: {
        ...where,
        actorUserId: { not: null },
      },
      distinct: ["actorUserId"],
      select: { actorUserId: true },
    }),
    db.auditLog.findMany({
      distinct: ["action"],
      orderBy: { action: "asc" },
      select: { action: true },
      take: 200,
    }),
    db.auditLog.findMany({
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
      select: { entityType: true },
      take: 200,
    }),
  ]);

  const rows = events.map((event) => [
    formatIstDateTime(event.createdAt),
    event.actor?.name ??
      event.actor?.email ??
      (event.actorUserId ? "Known user" : "System"),
    event.action.replaceAll("_", " "),
    event.entityType,
    event.entityId ?? "—",
    event.requestId ?? "—",
    <code key={event.id.toString()}>{metadataText(event.metadata)}</code>,
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (action) next.set("action", action);
    if (entityType) next.set("entityType", entityType);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/audit?${query}` : "/admin/audit";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + events.length, total);

  return (
    <AdminTablePage
      active="Audit Log"
      title="Audit Log"
      subtitle="Read-only security and operations history. Sensitive-looking metadata values are redacted in this view."
      metrics={[
        {
          label: "Matching Events",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Unique Actors",
          value: actors.length.toString(),
          meta: "current filters",
          tone: "orange",
        },
        {
          label: "Loaded",
          value: events.length.toString(),
          meta: "current page",
          tone: "blue",
        },
        {
          label: "Latest Event",
          value: events[0]?.createdAt ? formatIstDate(events[0].createdAt) : "—",
          meta: "current results",
          tone: "green",
        },
      ]}
      filters={[
        action ? action.replaceAll("_", " ") : "All actions",
        entityType || "All entity types",
        from || to ? `${from || "…"} → ${to || "…"}` : "All dates",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="auditSearch">
            <input
              id="auditSearch"
              name="q"
              defaultValue={q}
              placeholder="Actor, action, entity, request ID"
            />
          </AdminField>

          <AdminField label="Action" htmlFor="auditAction">
            <select id="auditAction" name="action" defaultValue={action}>
              <option value="">All actions</option>
              {actionOptions.map((item) => (
                <option key={item.action} value={item.action}>
                  {item.action.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Entity" htmlFor="auditEntity">
            <select
              id="auditEntity"
              name="entityType"
              defaultValue={entityType}
            >
              <option value="">All entity types</option>
              {entityOptions.map((item) => (
                <option key={item.entityType} value={item.entityType}>
                  {item.entityType}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="From" htmlFor="auditFrom">
            <input
              id="auditFrom"
              type="date"
              name="from"
              defaultValue={from}
            />
          </AdminField>

          <AdminField label="To" htmlFor="auditTo">
            <input
              id="auditTo"
              type="date"
              name="to"
              defaultValue={to}
            />
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || action || entityType || from || to) ? (
            <Link className="admin-secondary-button" href="/admin/audit">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Time",
        "Actor",
        "Action",
        "Entity",
        "Entity ID",
        "Request ID",
        "Metadata",
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
