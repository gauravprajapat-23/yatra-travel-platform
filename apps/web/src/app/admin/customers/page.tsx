import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const segments = ["NEW", "REPEAT", "VIP"] as const;
type CustomerSegment = (typeof segments)[number];

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function isSegment(value: string): value is CustomerSegment {
  return (segments as readonly string[]).includes(value);
}

function segmentFor(bookings: number): CustomerSegment {
  if (bookings >= 5) return "VIP";
  if (bookings >= 2) return "REPEAT";
  return "NEW";
}

function formatCurrencyTotals(
  totals: ReadonlyMap<string, bigint>,
): string {
  const values = [...totals.entries()]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => money(amount, currency));

  return values.length > 0 ? values.join(" · ") : "—";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    segment?: string;
    page?: string;
  }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "customer.read")) redirect("/admin");

  const params = await searchParams;
  const q = String(params.q ?? "").trim().toLowerCase().slice(0, 120);
  const segment = isSegment(String(params.segment ?? ""))
    ? (String(params.segment) as CustomerSegment)
    : null;
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

  const db = getDb();

  const [
    guestCarGroups,
    guestPackageGroups,
    accountCarGroups,
    accountPackageGroups,
  ] = await Promise.all([
    db.carBooking.groupBy({
      by: ["guestEmail", "guestName", "currency"],
      where: {
        customerUserId: null,
        guestEmail: { not: null },
      },
      _count: { _all: true },
      _sum: { totalMinor: true },
      _max: { createdAt: true },
    }),
    db.packageBooking.groupBy({
      by: ["guestEmail", "guestName", "currency"],
      where: {
        customerUserId: null,
        guestEmail: { not: null },
      },
      _count: { _all: true },
      _sum: { totalMinor: true },
      _max: { createdAt: true },
    }),
    db.carBooking.groupBy({
      by: ["customerUserId", "currency"],
      where: { customerUserId: { not: null } },
      _count: { _all: true },
      _sum: { totalMinor: true },
      _max: { createdAt: true },
    }),
    db.packageBooking.groupBy({
      by: ["customerUserId", "currency"],
      where: { customerUserId: { not: null } },
      _count: { _all: true },
      _sum: { totalMinor: true },
      _max: { createdAt: true },
    }),
  ]);

  const accountIds = [
    ...new Set(
      [...accountCarGroups, ...accountPackageGroups]
        .map((group) => group.customerUserId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const accountUsers = accountIds.length
    ? await db.user.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          email: true,
          emailNormalized: true,
          name: true,
          status: true,
        },
      })
    : [];
  const accountById = new Map(accountUsers.map((user) => [user.id, user]));

  const merged = new Map<
    string,
    {
      email: string;
      name: string;
      bookings: number;
      lifetimeByCurrency: Map<string, bigint>;
      lastBookingAt: Date | null;
      registered: boolean;
      active: boolean;
    }
  >();

  function mergeCustomer(input: {
    email: string;
    name: string;
    currency: string;
    amount: bigint;
    bookings: number;
    lastBookingAt: Date | null;
    registered: boolean;
    active: boolean;
  }) {
    const key = input.email.toLowerCase();
    const current = merged.get(key);

    if (!current) {
      merged.set(key, {
        email: key,
        name: input.name,
        bookings: input.bookings,
        lifetimeByCurrency: new Map([[input.currency, input.amount]]),
        lastBookingAt: input.lastBookingAt,
        registered: input.registered,
        active: input.active,
      });
      return;
    }

    current.bookings += input.bookings;
    current.lifetimeByCurrency.set(
      input.currency,
      (current.lifetimeByCurrency.get(input.currency) ?? 0n) + input.amount,
    );
    current.registered = current.registered || input.registered;
    current.active = current.active || input.active;

    if (
      input.lastBookingAt &&
      (!current.lastBookingAt || input.lastBookingAt > current.lastBookingAt)
    ) {
      current.lastBookingAt = input.lastBookingAt;
      current.name = input.name || current.name;
    }
  }

  for (const group of [...guestCarGroups, ...guestPackageGroups]) {
    if (!group.guestEmail) continue;

    mergeCustomer({
      email: group.guestEmail,
      name: group.guestName ?? "Guest customer",
      currency: group.currency,
      amount: group._sum.totalMinor ?? 0n,
      bookings: group._count._all,
      lastBookingAt: group._max.createdAt,
      registered: false,
      active: true,
    });
  }

  for (const group of [...accountCarGroups, ...accountPackageGroups]) {
    if (!group.customerUserId) continue;
    const account = accountById.get(group.customerUserId);
    if (!account) continue;

    mergeCustomer({
      email: account.emailNormalized,
      name: account.name ?? account.email,
      currency: group.currency,
      amount: group._sum.totalMinor ?? 0n,
      bookings: group._count._all,
      lastBookingAt: group._max.createdAt,
      registered: true,
      active: account.status === "ACTIVE",
    });
  }

  const allCustomers = [...merged.values()].sort((a, b) => {
    const aTime = a.lastBookingAt?.getTime() ?? 0;
    const bTime = b.lastBookingAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const filtered = allCustomers.filter((customer) => {
    const matchesSearch =
      !q ||
      customer.email.includes(q) ||
      customer.name.toLowerCase().includes(q);

    const customerSegment = segmentFor(customer.bookings);
    const matchesSegment = !segment || customerSegment === segment;

    return matchesSearch && matchesSegment;
  });

  const totalCustomers = filtered.length;
  const repeatCustomers = filtered.filter(
    (customer) => customer.bookings >= 2,
  ).length;

  const totalsByCurrency = new Map<string, bigint>();
  for (const customer of filtered) {
    for (const [currency, amount] of customer.lifetimeByCurrency) {
      totalsByCurrency.set(
        currency,
        (totalsByCurrency.get(currency) ?? 0n) + amount,
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;
  const pageCustomers = filtered.slice(skip, skip + PAGE_SIZE);

  const rows = pageCustomers.map((customer) => [
    <Link
      key={customer.email}
      href={`/admin/customers/${encodeURIComponent(customer.email)}`}
    >
      {customer.name}
    </Link>,
    customer.email,
    customer.lastBookingAt?.toLocaleDateString("en-IN") ?? "—",
    customer.bookings.toString(),
    formatCurrencyTotals(customer.lifetimeByCurrency),
    segmentFor(customer.bookings).replaceAll("_", " "),
    <StatusPill
      key={customer.email}
      tone={customer.active ? "green" : "red"}
    >
      {customer.registered
        ? customer.active
          ? "Registered"
          : "Account inactive"
        : "Guest"}
    </StatusPill>,
    <Link
      key={`${customer.email}-view`}
      href={`/admin/customers/${encodeURIComponent(customer.email)}`}
    >
      View
    </Link>,
  ]);

  function pageHref(targetPage: number) {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (segment) next.set("segment", segment);
    if (targetPage > 1) next.set("page", targetPage.toString());
    const query = next.toString();
    return query ? `/admin/customers?${query}` : "/admin/customers";
  }

  const firstShown = totalCustomers === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + pageCustomers.length, totalCustomers);

  return (
    <AdminTablePage
      active="Customers"
      title="Customers"
      subtitle="Live registered and guest customer rollup from car and package bookings."
      metrics={[
        {
          label: "Matching Customers",
          value: totalCustomers.toString(),
          meta: "current filters",
          tone: "blue",
        },
        {
          label: "Repeat Customers",
          value: repeatCustomers.toString(),
          meta: "2+ bookings",
          tone: "orange",
        },
        {
          label: "Booked Value",
          value: formatCurrencyTotals(totalsByCurrency),
          meta: "currency-safe totals",
          tone: "green",
        },
        {
          label: "Loaded",
          value: pageCustomers.length.toString(),
          meta: "current page",
          tone: "blue",
        },
      ]}
      filters={[
        segment ? `${segment} segment` : "All segments",
        q ? `Search: ${q}` : "All customers",
      ]}
      toolbar={
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Search" htmlFor="customerSearch">
            <input
              id="customerSearch"
              name="q"
              defaultValue={q}
              placeholder="Customer name or email"
            />
          </AdminField>

          <AdminField label="Segment" htmlFor="customerSegment">
            <select id="customerSegment" name="segment" defaultValue={segment ?? ""}>
              <option value="">All segments</option>
              {segments.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </AdminField>

          <button className="admin-primary-button" type="submit">
            Apply
          </button>

          {(q || segment) ? (
            <Link className="admin-secondary-button" href="/admin/customers">
              Reset
            </Link>
          ) : null}
        </form>
      }
      columns={[
        "Customer",
        "Email",
        "Last Booking",
        "Bookings",
        "Lifetime Booked Value",
        "Segment",
        "Status",
        "Actions",
      ]}
      rows={rows}
      footer={
        <>
          <span>
            Showing {firstShown}–{lastShown} of {totalCustomers}
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
