import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {
  bookingStatuses,
  canTransitionBooking,
  type BookingStatus,
} from "@yatra/domain/booking/status-machine";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  transitionCarBookingStatus,
  transitionPackageBookingStatus,
} from "@/modules/booking/booking-status-service";

function money(minor: bigint, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function isBookingStatus(value: string): value is BookingStatus {
  return (bookingStatuses as readonly string[]).includes(value);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "green";
  if (["PENDING_PAYMENT", "PENDING_REVIEW", "REFUND_PENDING"].includes(status)) return "orange";
  if (["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(status)) return "red";
  if (["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(status)) return "blue";
  return "gray";
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const { reference: rawReference } = await params;
  const reference = rawReference.trim().toUpperCase();
  const db = getDb();

  const isPackage = reference.startsWith("YPK-");

  const rawBooking = isPackage
    ? await db.packageBooking.findUnique({
        where: { reference },
        include: {
          package: { select: { title: true } },
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          paymentIntents: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              refunds: {
                orderBy: { createdAt: "desc" },
                take: 5,
              },
            },
          },
        },
      })
    : await db.carBooking.findUnique({
        where: { reference },
        include: {
          vehicleClass: { select: { name: true } },
          selectedVehicle: { select: { displayName: true, registrationNumber: true } },
          assignedDriver: { select: { name: true, phone: true } },
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          paymentIntents: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              refunds: {
                orderBy: { createdAt: "desc" },
                take: 5,
              },
            },
          },
        },
      });

  if (!rawBooking) notFound();

  const booking = isPackage
    ? {
        id: rawBooking.id,
        type: "PACKAGE" as const,
        reference: rawBooking.reference,
        status: rawBooking.status as BookingStatus,
        title: rawBooking.package.title,
        route: "Tour package",
        startsAt: rawBooking.travelStartAt,
        endsAt: null as Date | null,
        travellers: rawBooking.travellers,
        guestName: rawBooking.guestName,
        guestEmail: rawBooking.guestEmail,
        currency: rawBooking.currency,
        totalMinor: rawBooking.totalMinor,
        createdAt: rawBooking.createdAt,
        history: rawBooking.statusHistory,
        paymentIntents: rawBooking.paymentIntents,
        assignment: null as string | null,
      }
    : {
        id: rawBooking.id,
        type: "CAR" as const,
        reference: rawBooking.reference,
        status: rawBooking.status as BookingStatus,
        title: rawBooking.vehicleClass.name,
        route: `${rawBooking.originText} → ${rawBooking.destinationText}`,
        startsAt: rawBooking.startsAt,
        endsAt: rawBooking.endsAt,
        travellers: rawBooking.travellers,
        guestName: rawBooking.guestName,
        guestEmail: rawBooking.guestEmail,
        currency: rawBooking.currency,
        totalMinor: rawBooking.totalMinor,
        createdAt: rawBooking.createdAt,
        history: rawBooking.statusHistory,
        paymentIntents: rawBooking.paymentIntents,
        assignment: rawBooking.assignedDriver
          ? `${rawBooking.assignedDriver.name} · ${rawBooking.selectedVehicle?.displayName ?? "Vehicle pending"}`
          : null,
      };

  const nextStatuses = bookingStatuses.filter((status) =>
    canTransitionBooking(booking.status, status),
  );

  async function updateStatus(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "booking.write")) {
      redirect("/admin/bookings");
    }

    const toStatusValue = String(formData.get("toStatus") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!isBookingStatus(toStatusValue)) {
      throw new Error("Invalid booking status.");
    }

    if (booking.type === "CAR") {
      await transitionCarBookingStatus({
        bookingId: booking.id,
        toStatus: toStatusValue,
        actorUserId: currentSession.userId,
        reason,
      });
    } else {
      await transitionPackageBookingStatus({
        bookingId: booking.id,
        toStatus: toStatusValue,
        actorUserId: currentSession.userId,
        reason,
      });
    }

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: "BOOKING_STATUS_CHANGED",
        entityType: booking.type === "CAR" ? "CarBooking" : "PackageBooking",
        entityId: booking.id,
        metadata: {
          reference: booking.reference,
          toStatus: toStatusValue,
          reason: reason || null,
        },
      },
    });

    revalidatePath(`/admin/bookings/${booking.reference}`);
    revalidatePath("/admin/bookings");
  }

  return (
    <AdminShell
      active="Bookings"
      title={`Booking #${booking.reference}`}
      subtitle={`${booking.type === "CAR" ? "Car booking" : "Package booking"} · created ${booking.createdAt.toLocaleString("en-IN")}`}
      actions={<Link className="admin-secondary-button" href="/admin/bookings">← All Bookings</Link>}
    >
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Trip Overview</h2>
            <StatusPill tone={tone(booking.status)}>{booking.status.replaceAll("_", " ")}</StatusPill>
          </div>
          <h3>{booking.title}</h3>
          <p>{booking.route}</p>
          <dl>
            <div><dt>Departure</dt><dd>{booking.startsAt.toLocaleDateString("en-IN")}</dd></div>
            <div><dt>Return</dt><dd>{booking.endsAt?.toLocaleDateString("en-IN") ?? "As per booking"}</dd></div>
            <div><dt>Travellers</dt><dd>{booking.travellers}</dd></div>
            <div><dt>Assignment</dt><dd>{booking.assignment ?? "Not assigned"}</dd></div>
          </dl>
          <div className="admin-amount-card">
            <span>Total Amount</span>
            <strong>{money(booking.totalMinor, booking.currency)}</strong>
          </div>
        </section>

        <section className="admin-detail-column">
          <article className="admin-panel admin-detail-card">
            <h2>Customer</h2>
            <dl>
              <div><dt>Name</dt><dd>{booking.guestName ?? "Account customer"}</dd></div>
              <div><dt>Email</dt><dd>{booking.guestEmail ?? "Not available"}</dd></div>
              <div><dt>Reference</dt><dd>{booking.reference}</dd></div>
            </dl>
          </article>

          <article className="admin-panel admin-detail-card">
            <h2>Payment Activity</h2>
            {booking.paymentIntents.length === 0 ? (
              <p>No payment intent has been created yet.</p>
            ) : booking.paymentIntents.map((intent) => (
              <div key={intent.id}>
                <strong>{intent.status.replaceAll("_", " ")}</strong>
                <p>{money(intent.amountMinor, intent.currency)} · {intent.providerOrderId ?? "No provider order"}</p>
                {intent.refunds.map((refund) => (
                  <small key={refund.id}>
                    Refund {refund.status}: {money(refund.amountMinor, refund.currency)}
                  </small>
                ))}
              </div>
            ))}
          </article>
        </section>

        <section className="admin-detail-column">
          <article className="admin-panel admin-detail-card">
            <h2>Change Status</h2>
            {hasPermission(session.roles, "booking.write") && nextStatuses.length > 0 ? (
              <form action={updateStatus}>
                <label>
                  Next status
                  <select name="toStatus" required defaultValue="">
                    <option value="" disabled>Select status</option>
                    {nextStatuses.map((status) => (
                      <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason
                  <textarea name="reason" maxLength={500} placeholder="Operational note for the audit trail" />
                </label>
                <button className="admin-primary-button" type="submit">Update Status</button>
              </form>
            ) : (
              <p>No manual status transition is available for your role or the current state.</p>
            )}
          </article>

          <article className="admin-panel admin-detail-card">
            <h2>Booking Timeline</h2>
            <div className="admin-timeline">
              {booking.history.map((entry) => (
                <div key={entry.id.toString()}>
                  <span>✓</span>
                  <div>
                    <strong>{entry.toStatus.replaceAll("_", " ")}</strong>
                    <small>{entry.createdAt.toLocaleString("en-IN")}</small>
                    {entry.reason ? <p>{entry.reason}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
