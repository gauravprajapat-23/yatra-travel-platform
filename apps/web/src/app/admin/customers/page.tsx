import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export default async function CustomersPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "customer.read")) redirect("/admin");

  const db = getDb();

  const [carGroups, packageGroups] = await Promise.all([
    db.carBooking.groupBy({
      by: ["guestEmail", "guestName", "currency"],
      where: { guestEmail: { not: null } },
      _count: { _all: true },
      _sum: { totalMinor: true },
      _max: { createdAt: true },
    }),
    db.packageBooking.groupBy({
      by: ["guestEmail", "guestName", "currency"],
      where: { guestEmail: { not: null } },
      _count: { _all: true },
      _sum: { totalMinor: true },
      _max: { createdAt: true },
    }),
  ]);

  const merged = new Map<string, {
    email: string;
    name: string;
    currency: string;
    bookings: number;
    lifetimeMinor: bigint;
    lastBookingAt: Date | null;
  }>();

  for (const group of [...carGroups, ...packageGroups]) {
    if (!group.guestEmail) continue;
    const key = group.guestEmail.toLowerCase();
    const current = merged.get(key);

    if (!current) {
      merged.set(key, {
        email: key,
        name: group.guestName ?? "Guest customer",
        currency: group.currency,
        bookings: group._count._all,
        lifetimeMinor: group._sum.totalMinor ?? 0n,
        lastBookingAt: group._max.createdAt,
      });
      continue;
    }

    current.bookings += group._count._all;
    current.lifetimeMinor += group._sum.totalMinor ?? 0n;

    if (
      group._max.createdAt &&
      (!current.lastBookingAt || group._max.createdAt > current.lastBookingAt)
    ) {
      current.lastBookingAt = group._max.createdAt;
    }
  }

  const customers = [...merged.values()].sort((a, b) => {
    const aTime = a.lastBookingAt?.getTime() ?? 0;
    const bTime = b.lastBookingAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const totalCustomers = customers.length;
  const repeatCustomers = customers.filter((customer) => customer.bookings >= 2).length;
  const totalRevenueMinor = customers.reduce(
    (sum, customer) => sum + customer.lifetimeMinor,
    0n,
  );

  const rows = customers.slice(0, 100).map((customer) => [
    <Link key={customer.email} href={`/admin/customers/${encodeURIComponent(customer.email)}`}>
      {customer.name}
    </Link>,
    customer.email,
    customer.lastBookingAt?.toLocaleDateString("en-IN") ?? "—",
    customer.bookings.toString(),
    money(customer.lifetimeMinor, customer.currency),
    customer.bookings >= 5 ? "VIP" : customer.bookings >= 2 ? "Repeat" : "New",
    <StatusPill key={customer.email} tone="green">Active</StatusPill>,
    "—",
  ]);

  return (
    <AdminTablePage
      active="Customers"
      title="Customers"
      subtitle="Live guest-customer rollup from car and package bookings."
      metrics={[
        { label: "Total Customers", value: totalCustomers.toString(), meta: "unique booking emails", tone: "blue" },
        { label: "Repeat Customers", value: repeatCustomers.toString(), meta: "2+ bookings", tone: "orange" },
        { label: "Total Revenue", value: money(totalRevenueMinor), meta: "booked value", tone: "green" },
        { label: "Latest Loaded", value: Math.min(customers.length, 100).toString(), meta: "shown below", tone: "blue" },
      ]}
      filters={["Latest customers"]}
      columns={["Customer", "Email", "Last Booking", "Bookings", "Lifetime Value", "Segment", "Status", "Actions"]}
      rows={rows}
    />
  );
}
