import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function formatCurrencyTotals(totals: ReadonlyMap<string, bigint>): string {
  const values = [...totals.entries()]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => money(amount, currency));

  return values.length > 0 ? values.join(" · ") : "—";
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "green";
  if (["PENDING_PAYMENT", "PENDING_REVIEW", "REFUND_PENDING"].includes(status)) return "orange";
  if (["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(status)) return "red";
  if (["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(status)) return "blue";
  return "gray";
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "customer.read")) redirect("/admin");

  const { email: rawEmail } = await params;
  let email: string;
  try {
    email = decodeURIComponent(rawEmail).trim().toLowerCase();
  } catch {
    notFound();
  }

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    notFound();
  }

  const db = getDb();

  const customerUser = await db.user.findUnique({
    where: { emailNormalized: email },
    select: { id: true, name: true, email: true },
  });

  const customerWhere = customerUser
    ? {
        OR: [
          { customerUserId: customerUser.id },
          { customerUserId: null, guestEmail: email },
        ],
      }
    : { guestEmail: email };

  const [cars, packages] = await Promise.all([
    db.carBooking.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        status: true,
        currency: true,
        totalMinor: true,
        createdAt: true,
      },
    }),
    db.packageBooking.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      select: {
        reference: true,
        guestName: true,
        travelStartAt: true,
        status: true,
        currency: true,
        totalMinor: true,
        createdAt: true,
        package: { select: { title: true } },
      },
    }),
  ]);

  if (cars.length === 0 && packages.length === 0) notFound();

  const bookings = [
    ...cars.map((booking) => ({
      reference: booking.reference,
      name: booking.guestName,
      title: `${booking.originText} → ${booking.destinationText}`,
      startsAt: booking.startsAt,
      status: booking.status,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
      createdAt: booking.createdAt,
    })),
    ...packages.map((booking) => ({
      reference: booking.reference,
      name: booking.guestName,
      title: booking.package.title,
      startsAt: booking.travelStartAt,
      status: booking.status,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
      createdAt: booking.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const lifetimeByCurrency = new Map<string, bigint>();
  for (const booking of bookings) {
    lifetimeByCurrency.set(
      booking.currency,
      (lifetimeByCurrency.get(booking.currency) ?? 0n) + booking.totalMinor,
    );
  }
  const latest = bookings[0];

  return (
    <AdminShell
      active="Customers"
      title={customerUser?.name ?? latest?.name ?? "Guest Customer"}
      subtitle={customerUser ? `${customerUser.email} · registered account` : email}
      actions={<Link className="admin-secondary-button" href="/admin/customers">← All Customers</Link>}
    >
      <div className="admin-metric-grid">
        <article className="admin-metric">
          <small>Total Bookings</small>
          <strong>{bookings.length}</strong>
        </article>
        <article className="admin-metric">
          <small>Booked Value</small>
          <strong>{formatCurrencyTotals(lifetimeByCurrency)}</strong>
        </article>
        <article className="admin-metric">
          <small>Last Booking</small>
          <strong>{latest?.createdAt.toLocaleDateString("en-IN") ?? "—"}</strong>
        </article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Booking History</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Trip / Package</th>
                <th>Travel Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.reference}>
                  <td>
                    <Link href={`/admin/bookings/${booking.reference}`}>
                      {booking.reference}
                    </Link>
                  </td>
                  <td>{booking.title}</td>
                  <td>{booking.startsAt.toLocaleDateString("en-IN")}</td>
                  <td>{money(booking.totalMinor, booking.currency)}</td>
                  <td>
                    <StatusPill tone={tone(booking.status)}>
                      {booking.status.replaceAll("_", " ")}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
