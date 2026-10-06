import Link from "next/link";
import { getDb } from "@yatra/db/client";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "green";
  if (["PENDING_PAYMENT", "PENDING_REVIEW", "REFUND_PENDING"].includes(status)) return "orange";
  if (["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(status)) return "red";
  if (["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(status)) return "blue";
  return "gray";
}

export default async function AdminDashboardPage() {
  const db = getDb();
  const now = new Date();

  const [
    carCount,
    packageCount,
    activeCars,
    activePackages,
    pendingLeads,
    capturedPayments,
    recentCars,
    recentPackages,
  ] = await Promise.all([
    db.carBooking.count(),
    db.packageBooking.count(),
    db.carBooking.count({
      where: { status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] } },
    }),
    db.packageBooking.count({
      where: { status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] } },
    }),
    db.lead.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    db.paymentIntent.aggregate({
      where: { status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _sum: { amountPaidMinor: true },
    }),
    db.carBooking.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        totalMinor: true,
        currency: true,
        status: true,
        createdAt: true,
      },
    }),
    db.packageBooking.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        reference: true,
        guestName: true,
        totalMinor: true,
        currency: true,
        status: true,
        createdAt: true,
        package: { select: { title: true } },
      },
    }),
  ]);

  const recent = [
    ...recentCars.map((booking) => ({
      reference: booking.reference,
      customer: booking.guestName ?? "Guest",
      route: `${booking.originText} → ${booking.destinationText}`,
      amount: money(booking.totalMinor, booking.currency),
      status: booking.status,
      createdAt: booking.createdAt,
    })),
    ...recentPackages.map((booking) => ({
      reference: booking.reference,
      customer: booking.guestName ?? "Guest",
      route: booking.package.title,
      amount: money(booking.totalMinor, booking.currency),
      status: booking.status,
      createdAt: booking.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  const totalBookings = carCount + packageCount;
  const activeTrips = activeCars + activePackages;
  const revenueMinor = capturedPayments._sum.amountPaidMinor ?? 0n;

  return (
    <AdminShell
      active="Dashboard"
      title="Dashboard"
      subtitle={`Live operations snapshot · ${now.toLocaleDateString("en-IN")}`}
    >
      <div className="admin-metric-grid">
        <AdminMetric label="Total Bookings" value={totalBookings.toString()} meta="car + package" tone="green"/>
        <AdminMetric label="Captured Revenue" value={money(revenueMinor)} meta="verified payments" tone="orange"/>
        <AdminMetric label="Active Trips" value={activeTrips.toString()} meta="confirmed / assigned / in progress" tone="green"/>
        <AdminMetric label="Pending Leads" value={pendingLeads.toString()} meta="new + in progress" tone="red"/>
      </div>

      <div className="admin-dashboard-grid admin-dashboard-grid--tables">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent Bookings</h2>
            <Link href="/admin/bookings">View All →</Link>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Route / Package</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5}>No bookings yet.</td>
                </tr>
              ) : recent.map((booking) => (
                <tr key={booking.reference}>
                  <td>
                    <Link href={`/admin/bookings/${booking.reference}`}>
                      {booking.reference}
                    </Link>
                  </td>
                  <td>{booking.customer}</td>
                  <td>{booking.route}</td>
                  <td>{booking.amount}</td>
                  <td>
                    <StatusPill tone={tone(booking.status)}>
                      {booking.status.replaceAll("_", " ")}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Operations</h2>
          </div>
          <div className="admin-detail-card">
            <p>Use the live operational views to review customer activity and financial state.</p>
            <p><Link href="/admin/bookings">Bookings →</Link></p>
            <p><Link href="/admin/payments">Payments & refunds →</Link></p>
            <p><Link href="/admin/leads">Leads & enquiries →</Link></p>
            <p><Link href="/admin/customers">Customers →</Link></p>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
