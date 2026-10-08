import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/admin/datetime";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED"] as const;
const channels = ["EMAIL", "SMS", "WHATSAPP"] as const;

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "SENT") return "green";
  if (status === "FAILED") return "red";
  if (status === "PROCESSING") return "blue";
  if (status === "PENDING") return "orange";
  return "gray";
}

function maskDestination(value: string): string {
  const trimmed = value.trim();
  const at = trimmed.indexOf("@");
  if (at > 0) {
    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    const visible = local.slice(0, 1);
    return `${visible}${"*".repeat(Math.min(6, Math.max(3, local.length - 1)))}@${domain}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4) {
    return `•••• ${digits.slice(-4)}`;
  }

  return "Protected destination";
}

function boundedText(value: string | null, max = 180): string {
  if (!value) return "—";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max)}…`
    : normalized;
}

export default async function NotificationDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    channel?: string;
    purpose?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "notification.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 160);
  const requestedStatus = String(params.status ?? "").trim().toUpperCase();
  const status = (statuses as readonly string[]).includes(requestedStatus)
    ? requestedStatus
    : "";
  const requestedChannel = String(params.channel ?? "").trim().toUpperCase();
  const channel = (channels as readonly string[]).includes(requestedChannel)
    ? requestedChannel
    : "";
  const purpose = String(params.purpose ?? "").trim().slice(0, 120);
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const where: Prisma.NotificationDeliveryWhereInput = {
    ...(status ? { status: status as never } : {}),
    ...(channel ? { channel: channel as never } : {}),
    ...(purpose ? { purpose } : {}),
    ...(q
      ? {
          OR: [
            { destination: { contains: q, mode: "insensitive" } },
            { provider: { contains: q, mode: "insensitive" } },
            { providerMessageId: { contains: q, mode: "insensitive" } },
            { templateKey: { contains: q, mode: "insensitive" } },
            {
              user: {
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

  const db = getDb();
  const total = await db.notificationDelivery.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const [deliveries, statusGroups, purposeOptions] = await Promise.all([
    db.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        channel: true,
        purpose: true,
        destination: true,
        templateKey: true,
        status: true,
        provider: true,
        providerMessageId: true,
        attemptCount: true,
        sentAt: true,
        failedAt: true,
        lastError: true,
        createdAt: true,
      },
    }),
    db.notificationDelivery.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.notificationDelivery.findMany({
      distinct: ["purpose"],
      orderBy: { purpose: "asc" },
      select: { purpose: true },
      take: 100,
    }),
  ]);

  const counts = new Map(
    statusGroups.map((group) => [group.status, group._count._all]),
  );

  const rows = deliveries.map((delivery) => [
    formatIstDateTime(delivery.createdAt),
    <StatusPill key={`${delivery.id}-status`} tone={tone(delivery.status)}>
      {delivery.status}
    </StatusPill>,
    delivery.channel,
    delivery.purpose.replaceAll("_", " "),
    maskDestination(delivery.destination),
    delivery.provider ?? "Not assigned",
    delivery.providerMessageId ?? "—",
    delivery.attemptCount.toString(),
    delivery.sentAt
      ? `Sent ${formatIstDateTime(delivery.sentAt)}`
      : delivery.failedAt
        ? `Failed ${formatIstDateTime(delivery.failedAt)} · ${boundedText(delivery.lastError)}`
        : boundedText(delivery.lastError),
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    if (channel) next.set("channel", channel);
    if (purpose) next.set("purpose", purpose);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query
      ? `/admin/notifications?${query}`
      : "/admin/notifications";
  }

  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + deliveries.length, total);

  return (
    <AdminTablePage
      active="Notifications"
      title="Notification Deliveries"
      subtitle="Read-only delivery monitoring. Destinations are masked and authentication tokens/template payloads are never displayed."
      metrics={[
        {
          label: "Pending",
          value: String(counts.get("PENDING") ?? 0),
          meta: "waiting for delivery",
          tone: "orange",
        },
        {
          label: "Processing",
          value: String(counts.get("PROCESSING") ?? 0),
          meta: "currently claimed",
          tone: "blue",
        },
        {
          label: "Sent",
          value: String(counts.get("SENT") ?? 0),
          meta: "provider accepted",
          tone: "green",
        },
        {
          label: "Failed",
          value: String(counts.get("FAILED") ?? 0),
          meta: "needs investigation",
          tone: "red",
        },
      ]}
      filters={[
        status || "All statuses",
        channel || "All channels",
        purpose ? purpose.replaceAll("_", " ") : "All purposes",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="notificationSearch">
            <input
              id="notificationSearch"
              name="q"
              defaultValue={q}
              placeholder="Destination, provider, message ID"
            />
          </AdminField>

          <AdminField label="Status" htmlFor="notificationStatus">
            <select id="notificationStatus" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Channel" htmlFor="notificationChannel">
            <select id="notificationChannel" name="channel" defaultValue={channel}>
              <option value="">All channels</option>
              {channels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </AdminField>

          <AdminField label="Purpose" htmlFor="notificationPurpose">
            <select id="notificationPurpose" name="purpose" defaultValue={purpose}>
              <option value="">All purposes</option>
              {purposeOptions.map((item) => (
                <option key={item.purpose} value={item.purpose}>
                  {item.purpose.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status || channel || purpose) ? (
            <Link className="admin-secondary-button" href="/admin/notifications">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Created",
        "Status",
        "Channel",
        "Purpose",
        "Destination",
        "Provider",
        "Provider Message",
        "Attempts",
        "Outcome",
      ]}
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
