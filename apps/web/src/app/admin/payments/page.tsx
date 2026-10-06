import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CAPTURED", "PROCESSED"].includes(status)) return "green";
  if (["AUTHORIZED", "CREATED", "PENDING"].includes(status)) return "orange";
  if (["FAILED", "CANCELLED", "REFUNDED"].includes(status)) return "red";
  if (status === "PARTIALLY_REFUNDED") return "blue";
  return "gray";
}

export default async function PaymentsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "payment.read")) redirect("/admin");

  const db = getDb();

  const [intents, refunds, capturedAgg, pendingAgg, processedRefundAgg] =
    await Promise.all([
      db.paymentIntent.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          carBooking: {
            select: { reference: true, guestName: true, guestEmail: true },
          },
          packageBooking: {
            select: { reference: true, guestName: true, guestEmail: true },
          },
        },
      }),
      db.refund.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
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
      db.paymentIntent.aggregate({
        where: {
          status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
        },
        _sum: { amountPaidMinor: true },
      }),
      db.paymentIntent.aggregate({
        where: { status: { in: ["CREATED", "AUTHORIZED"] } },
        _sum: { amountMinor: true },
      }),
      db.refund.aggregate({
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
        money(intent.amountPaidMinor > 0n ? intent.amountPaidMinor : intent.amountMinor, intent.currency),
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

  const rows = [...paymentRows, ...refundRows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 50)
    .map((entry) => entry.cells);

  const capturedMinor = capturedAgg._sum.amountPaidMinor ?? 0n;
  const refundMinor = processedRefundAgg._sum.amountMinor ?? 0n;
  const pendingMinor = pendingAgg._sum.amountMinor ?? 0n;

  return (
    <AdminTablePage
      active="Payments"
      title="Payments"
      subtitle="Live Razorpay payment intents and refund ledger from Neon."
      metrics={[
        { label: "Captured Payments", value: money(capturedMinor), meta: "verified provider captures", tone: "green" },
        { label: "Processed Refunds", value: money(refundMinor), meta: "verified refunds", tone: "red" },
        { label: "Net Captured", value: money(capturedMinor - refundMinor), meta: "captured less processed refunds", tone: "blue" },
        { label: "Awaiting Capture", value: money(pendingMinor), meta: "created / authorized intents", tone: "orange" },
      ]}
      filters={["Latest 50"]}
      columns={["Date", "Provider ID", "Booking ID", "Customer", "Type", "Provider", "Amount", "Status", "Reconcile"]}
      rows={rows}
    />
  );
}
