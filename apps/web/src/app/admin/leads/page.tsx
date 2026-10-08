import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate } from "@/lib/admin/datetime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const leadStatuses = ["NEW", "IN_PROGRESS", "QUALIFIED", "CLOSED", "SPAM"] as const;
const leadTypes = ["CONTACT", "CUSTOM_TRIP"] as const;

type LeadStatusValue = (typeof leadStatuses)[number];
type LeadTypeValue = (typeof leadTypes)[number];

function isLeadStatus(value: string): value is LeadStatusValue {
  return (leadStatuses as readonly string[]).includes(value);
}

function isLeadType(value: string): value is LeadTypeValue {
  return (leadTypes as readonly string[]).includes(value);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "QUALIFIED" || status === "CLOSED") return "green";
  if (status === "IN_PROGRESS") return "blue";
  if (status === "SPAM") return "red";
  if (status === "NEW") return "orange";
  return "gray";
}

function interest(type: string, tripData: unknown): string {
  if (type === "CONTACT") return "General enquiry";
  if (typeof tripData === "object" && tripData !== null) {
    const data = tripData as Record<string, unknown>;
    for (const key of ["destination", "package", "route", "tripType"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "Custom trip";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "lead.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const status = isLeadStatus(String(params.status ?? ""))
    ? (String(params.status) as LeadStatusValue)
    : null;
  const type = isLeadType(String(params.type ?? ""))
    ? (String(params.type) as LeadTypeValue)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const baseWhere: Prisma.LeadWhereInput = {
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { sourcePath: { contains: q, mode: "insensitive" } },
            { message: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const where: Prisma.LeadWhereInput = {
    ...baseWhere,
    ...(status ? { status } : {}),
  };

  const total = await db.lead.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [leads, newCount, inProgressCount, qualifiedCount] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.lead.count({ where: { ...baseWhere, status: "NEW" } }),
    db.lead.count({ where: { ...baseWhere, status: "IN_PROGRESS" } }),
    db.lead.count({ where: { ...baseWhere, status: "QUALIFIED" } }),
  ]);

  const rows = leads.map((lead) => [
    lead.name,
    lead.phone ?? lead.email,
    lead.sourcePath ?? "Website",
    interest(lead.type, lead.tripData),
    <StatusPill key={`${lead.id}-status`} tone={tone(lead.status)}>
      {lead.status.replaceAll("_", " ")}
    </StatusPill>,
    formatIstDate(lead.createdAt),
    <Link key={lead.reference} href={`/admin/leads/${lead.reference}`}>
      {lead.reference}
    </Link>,
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (type) next.set("type", type);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/leads?${query}` : "/admin/leads";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + leads.length, total);

  return (
    <AdminTablePage
      active="Enquiries / Leads"
      title="Leads & Enquiries"
      subtitle="Live contact and custom-trip enquiries captured from the public website."
      metrics={[
        {
          label: "Matching Leads",
          value: total.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "New Leads",
          value: newCount.toString(),
          meta: "current search/type",
          tone: "orange",
        },
        {
          label: "In Progress",
          value: inProgressCount.toString(),
          meta: "current search/type",
          tone: "blue",
        },
        {
          label: "Qualified",
          value: qualifiedCount.toString(),
          meta: "current search/type",
          tone: "green",
        },
      ]}
      filters={[
        type ? type.replaceAll("_", " ") : "All enquiry types",
        status ? status.replaceAll("_", " ") : "All statuses",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="leadSearch">
            <input
              id="leadSearch"
              name="q"
              defaultValue={q}
              placeholder="Reference, name, email, phone or source"
            />
          </AdminField>

          <AdminField label="Type" htmlFor="leadType">
            <select id="leadType" name="type" defaultValue={type ?? ""}>
              <option value="">All types</option>
              {leadTypes.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Status" htmlFor="leadStatus">
            <select
              id="leadStatus"
              name="status"
              defaultValue={status ?? ""}
            >
              <option value="">All statuses</option>
              {leadStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status || type) ? (
            <Link className="admin-secondary-button" href="/admin/leads">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Name",
        "Contact",
        "Source",
        "Interest",
        "Status",
        "Created",
        "Reference",
      ]}
      emptyTitle={
        q || status || type
          ? "No leads match these filters"
          : "No enquiries captured yet"
      }
      emptyMessage={
        q || status || type
          ? "Clear or adjust the current search, type or status filters."
          : "Public contact and custom-trip enquiries will appear here automatically."
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
