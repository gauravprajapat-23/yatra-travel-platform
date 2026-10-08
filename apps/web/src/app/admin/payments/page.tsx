import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const paymentStatuses = [
  "CREATED",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
const refundStatuses = ["PENDING", "PROCESSED", "FAILED", "CANCELLED"] as const;

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function formatCurrencyMap(values: ReadonlyMap<string, bigint>): string {
  const rendered = [...values.entries()]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => money(amount, currency));

  return rendered.length > 0 ? rendered.join(" · ") : "—";
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CAPTURED", "PROCESSED"].includes(status)) return "green";
  if (["AUTHORIZED", "CREATED", "PENDING"].includes(status)) return "orange";
  if (["FAILED", "CANCELLED", "REFUNDED"].includes(status)) return "red";
  if (status === "PARTIALLY_REFUNDED") return "blue";
  return "gray";
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "payment.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 120);
  const type =
    params.type === "PAYMENT" || params.type === "REFUND"
      ? params.type
      : "ALL";
  const requestedStatus = String(params.status ?? "").trim().toUpperCase();
  const status =
    (paymentStatuses as readonly string[]).includes(requestedStatus) ||
    (refundStatuses as readonly string[]).includes(requestedStatus)
      ? requestedStatus
      : "";
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const paymentStatus =
    (paymentStatuses as readonly string[]).includes(status) ? status : null;
  const refundStatus =
    (refundStatuses as readonly string[]).includes(status) ? status : null;

  const paymentWhere: Prisma.PaymentIntentWhereInput = {
    ...(paymentStatus ? { status: paymentStatus as never } : {}),
    ...(status && !paymentStatus ? { id: "__no_payment_status_match__" } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { providerOrderId: { contains: q, mode: "insensitive" } },
            { providerPaymentId: { contains: q, mode: "insensitive" } },
            {
              carBooking: {
                OR: [
                  { reference: { contains: q, mode: "insensitive" } },
                  { guestName: { contains: q, mode: "insensitive" } },
                  { guestEmail: { contains: q, mode: "insensitive" } },
                ],
              },
            },
            {
              packageBooking: {
                OR: [
                  { reference: { contains: q, mode: "insensitive" } },
                  { guestName: { contains: q, mode: "insensitive" } },
                  { guestEmail: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const refundWhere: Prisma.RefundWhereInput = {
    ...(refundStatus ? { status: refundStatus as never } : {}),
    ...(status && !refundStatus ? { id: "__no_refund_status_match__" } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { providerRefundId: { contains: q, mode: "insensitive" } },
            {
              paymentIntent: {
                OR: [
                  { providerOrderId: { contains: q, mode: "insensitive" } },
                  { providerPaymentId: { contains: q, mode: "insensitive" } },
                  {
                    carBooking: {
                      OR: [
                        { reference: { contains: q, mode: "insensitive" } },
                        { guestName: { contains: q, mode: "insensitive" } },
                        { guestEmail: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                  {
                    packageBooking: {
                      OR: [
                        { reference: { contains: q, mode: "insensitive" } },
                        { guestName: { contains: q, mode: "insensitive" } },
                        { guestEmail: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const fetchLimit = page * PAGE_SIZE;

  const [
    intents,
    refunds,
    paymentCount,
    refundCount,
    capturedGroups,
    pendingGroups,
    processedRefundGroups,
  ] = await Promise.all([
    type === "REFUND"
      ? Promise.resolve([])
      : db.paymentIntent.findMany({
          where: paymentWhere,
          orderBy: { createdAt: "desc" },
          take: fetchLimit,
          include: {
            carBooking: {
              select: { reference: true, guestName: true, guestEmail: true },
            },
            packageBooking: {
              select: { reference: true, guestName: true, guestEmail: true },
            },
          },
        }),
    type === "PAYMENT"
      ? Promise.resolve([])
      : db.refund.findMany({
          where: refundWhere,
          orderBy: { createdAt: "desc" },
          take: fetchLimit,
          include: {
            paymentIntent: {
              include: {
                carBooking: {
                  select: { reference: true, guestName: true, guestEmail: true },
                },
                packageBooking: {
                  select: { reference: true, guestName: true, guestEmail: true },
                },
              },
            },
          },
        }),
    type === "REFUND"
      ? Promise.resolve(0)
      : db.paymentIntent.count({ where: paymentWhere }),
    type === "PAYMENT"
      ? Promise.resolve(0)
      : db.refund.count({ where: refundWhere }),
    db.paymentIntent.groupBy({
      by: ["currency"],
      where: {
        status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
      _sum: { amountPaidMinor: true },
    }),
    db.paymentIntent.groupBy({
      by: ["currency"],
      where: { status: { in: ["CREATED", "AUTHORIZED"] } },
      _sum: { amountMinor: true },
    }),
    db.refund.groupBy({
      by: ["currency"],
      where: { status: "PROCESSED" },
      _sum: { amountMinor: true },
    }),
  ]);

  const paymentRows = intents.map((intent) => {
    const booking = intent.carBooking ?? intent.packageBooking;
    const reference = booking?.reference ?? "Unlinked";
    const customer = booking?.guestName ?? booking?.guestEmail ?? "Unknown";

    return {
      createdAt: intent.createdAt,
      cells: [
        intent.createdAt.toLocaleDateString("en-IN"),
        intent.providerPaymentId ?? intent.providerOrderId ?? intent.id,
        reference === "Unlinked" ? reference : (
          <Link key={`${intent.id}-booking`} href={`/admin/bookings/${reference}`}>
            {reference}
          </Link>
        ),
        customer,
        "Payment",
        "Razorpay",
        money(
          intent.amountPaidMinor > 0n
            ? intent.amountPaidMinor
            : intent.amountMinor,
          intent.currency,
        ),
        <StatusPill key={`${intent.id}-status`} tone={tone(intent.status)}>
          {intent.status.replaceAll("_", " ")}
        </StatusPill>,
        intent.capturedAt ? "Verified" : "—",
      ],
    };
  });

  const refundRows = refunds.map((refund) => {
    const booking =
      refund.paymentIntent.carBooking ?? refund.paymentIntent.packageBooking;
    const reference = booking?.reference ?? "Unlinked";
    const customer = booking?.guestName ?? booking?.guestEmail ?? "Unknown";

    return {
      createdAt: refund.createdAt,
      cells: [
        refund.createdAt.toLocaleDateString("en-IN"),
        refund.providerRefundId ?? refund.id,
        reference === "Unlinked" ? reference : (
          <Link key={`${refund.id}-booking`} href={`/admin/bookings/${reference}`}>
            {reference}
          </Link>
        ),
        customer,
        "Refund",
        "Razorpay",
        money(refund.amountMinor, refund.currency),
        <StatusPill key={`${refund.id}-status`} tone={tone(refund.status)}>
          {refund.status.replaceAll("_", " ")}
        </StatusPill>,
        refund.processedAt ? "Verified" : "—",
      ],
    };
  });

  const combined = [...paymentRows, ...refundRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const matchingCount = paymentCount + refundCount;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const rows = combined.slice(offset, offset + PAGE_SIZE).map((entry) => entry.cells);

  const capturedByCurrency = new Map<string, bigint>(
    capturedGroups.map((group) => [
      group.currency,
      group._sum.amountPaidMinor ?? 0n,
    ]),
  );
  const pendingByCurrency = new Map<string, bigint>(
    pendingGroups.map((group) => [
      group.currency,
      group._sum.amountMinor ?? 0n,
    ]),
  );
  const refundedByCurrency = new Map<string, bigint>(
    processedRefundGroups.map((group) => [
      group.currency,
      group._sum.amountMinor ?? 0n,
    ]),
  );
  const netByCurrency = new Map<string, bigint>();
  const currencies = new Set([
    ...capturedByCurrency.keys(),
    ...refundedByCurrency.keys(),
  ]);
  for (const currency of currencies) {
    netByCurrency.set(
      currency,
      (capturedByCurrency.get(currency) ?? 0n) -
        (refundedByCurrency.get(currency) ?? 0n),
    );
  }

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (type !== "ALL") next.set("type", type);
    if (status) next.set("status", status);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/payments?${query}` : "/admin/payments";
  }

  const firstShown = matchingCount === 0 ? 0 : offset + 1;
  const lastShown = Math.min(offset + rows.length, matchingCount);
  const allStatuses = [...new Set([...paymentStatuses, ...refundStatuses])];

  return (
    <AdminTablePage
      active="Payments"
      title="Payments"
      subtitle="Live Razorpay payment and refund ledger with server-side search and filters."
      metrics={[
        {
          label: "Captured Payments",
          value: formatCurrencyMap(capturedByCurrency),
          meta: "verified provider captures",
          tone: "green",
        },
        {
          label: "Processed Refunds",
          value: formatCurrencyMap(refundedByCurrency),
          meta: "verified refunds",
          tone: "red",
        },
        {
          label: "Net Captured",
          value: formatCurrencyMap(netByCurrency),
          meta: "captured less processed refunds",
          tone: "blue",
        },
        {
          label: "Awaiting Capture",
          value: formatCurrencyMap(pendingByCurrency),
          meta: "created / authorized intents",
          tone: "orange",
        },
      ]}
      filters={[
        type === "ALL" ? "Payments + refunds" : type,
        status ? status.replaceAll("_", " ") : "All statuses",
      ]}
      toolbar={
        <form className="admin-table-query" method="get">
          <AdminField label="Search" htmlFor="paymentSearch">
            <input
              id="paymentSearch"
              name="q"
              defaultValue={q}
              placeholder="Provider ID, booking, customer or email"
            />
          </AdminField>

          <AdminField label="Type" htmlFor="paymentType">
            <select id="paymentType" name="type" defaultValue={type}>
              <option value="ALL">Payments + refunds</option>
              <option value="PAYMENT">Payments</option>
              <option value="REFUND">Refunds</option>
            </select>
          </AdminField>

          <AdminField label="Status" htmlFor="paymentStatus">
            <select id="paymentStatus" name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {allStatuses.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || status || type !== "ALL") ? (
            <Link className="admin-secondary-button" href="/admin/payments">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Date",
        "Provider ID",
        "Booking ID",
        "Customer",
        "Type",
        "Provider",
        "Amount",
        "Status",
        "Reconcile",
      ]}
      rows={rows}
      footer={
        <>
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
        </>
      }
    />
  );
}
