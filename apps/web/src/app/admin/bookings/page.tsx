import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function money(minor: bigint, currency: string) {
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

export default async function AdminBookingsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const db = getDb();

  const [cars, packages, carCount, packageCount] = await Promise.all([
    db.carBooking.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        currency: true,
        totalMinor: true,
        status: true,
        vehicleClass: { select: { name: true } },
        createdAt: true,
      },
    }),
    db.packageBooking.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        reference: true,
        guestName: true,
        travelStartAt: true,
        currency: true,
        totalMinor: true,
        status: true,
        package: { select: { title: true } },
        createdAt: true,
      },
    }),
    db.carBooking.count(),
    db.packageBooking.count(),
  ]);

  const combined = [
    ...cars.map((booking) => ({
      type: "CAR" as const,
      reference: booking.reference,
      customer: booking.guestName,
      summary: `${booking.originText} → ${booking.destinationText}`,
      date: booking.startsAt,
      vehicle: booking.vehicleClass.name,
      amount: money(booking.totalMinor, booking.currency),
      status: booking.status,
      createdAt: booking.createdAt,
    })),
    ...packages.map((booking) => ({
      type: "PACKAGE" as const,
      reference: booking.reference,
      customer: booking.guestName,
      summary: booking.package.title,
      date: booking.travelStartAt,
      vehicle: "Tour package",
      amount: money(booking.totalMinor, booking.currency),
      status: booking.status,
      createdAt: booking.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50);

  const allCount = carCount + packageCount;
  const confirmed = combined.filter((booking) => booking.status === "CONFIRMED").length;
  const pending = combined.filter((booking) =>
    ["PENDING_PAYMENT", "PENDING_REVIEW"].includes(booking.status),
  ).length;
  const completed = combined.filter((booking) => booking.status === "COMPLETED").length;

  const rows = combined.map((booking) => [
    <Link key={booking.reference} href={`/admin/bookings/${booking.reference}`}>
      {booking.reference}
    </Link>,
    booking.customer,
    booking.summary,
    booking.date.toLocaleDateString("en-IN"),
    booking.vehicle,
    booking.amount,
    <StatusPill key={`${booking.reference}-status`} tone={tone(booking.status)}>
      {booking.status.replaceAll("_", " ")}
    </StatusPill>,
    <Link key={`${booking.reference}-view`} href={`/admin/bookings/${booking.reference}`}>
      View
    </Link>,
  ]);

  return (
    <AdminTablePage
      active="Bookings"
      title="Bookings"
      subtitle="Live car and package bookings from Neon, newest first."
      metrics={[
        { label: "All Bookings", value: allCount.toString(), meta: "all time", tone: "orange" },
        { label: "Confirmed", value: confirmed.toString(), meta: "latest 50", tone: "green" },
        { label: "Pending", value: pending.toString(), meta: "latest 50", tone: "orange" },
        { label: "Completed", value: completed.toString(), meta: "latest 50", tone: "blue" },
      ]}
      filters={["Latest 50"]}
      columns={["Booking ID", "Customer", "Route / Package", "Date", "Vehicle / Type", "Amount", "Status", "Actions"]}
      rows={rows}
    />
  );
}
