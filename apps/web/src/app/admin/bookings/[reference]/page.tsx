import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {

export const dynamic = "force-dynamic";
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
import { assignCarBookingResources } from "@/modules/booking/car-assignment-service";

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
    ? {
        type: "PACKAGE" as const,
        data: await db.packageBooking.findUnique({
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
      }),
      }
    : {
        type: "CAR" as const,
        data: await db.carBooking.findUnique({
        where: { reference },
        include: {
          vehicleClass: { select: { name: true } },
          selectedVehicle: { select: { displayName: true, registrationNumber: true } },
          assignedDriver: { select: { displayName: true, phoneLast4: true } },
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
      }),
      };

  if (!rawBooking.data) notFound();

  const booking = rawBooking.type === "PACKAGE"
    ? {
        id: rawBooking.data.id,
        type: "PACKAGE" as const,
        reference: rawBooking.data.reference,
        status: rawBooking.data.status as BookingStatus,
        title: rawBooking.data.package.title,
        route: "Tour package",
        startsAt: rawBooking.data.travelStartAt,
        endsAt: null as Date | null,
        travellers: rawBooking.data.travellers,
        guestName: rawBooking.data.guestName,
        guestEmail: rawBooking.data.guestEmail,
        currency: rawBooking.data.currency,
        totalMinor: rawBooking.data.totalMinor,
        createdAt: rawBooking.data.createdAt,
        history: rawBooking.data.statusHistory,
        paymentIntents: rawBooking.data.paymentIntents,
        assignment: null as string | null,
        vehicleClassId: null as string | null,
      }
    : {
        id: rawBooking.data.id,
        type: "CAR" as const,
        reference: rawBooking.data.reference,
        status: rawBooking.data.status as BookingStatus,
        title: rawBooking.data.vehicleClass.name,
        route: `${rawBooking.data.originText} → ${rawBooking.data.destinationText}`,
        startsAt: rawBooking.data.startsAt,
        endsAt: rawBooking.data.endsAt,
        travellers: rawBooking.data.travellers,
        guestName: rawBooking.data.guestName,
        guestEmail: rawBooking.data.guestEmail,
        currency: rawBooking.data.currency,
        totalMinor: rawBooking.data.totalMinor,
        createdAt: rawBooking.data.createdAt,
        history: rawBooking.data.statusHistory,
        paymentIntents: rawBooking.data.paymentIntents,
        assignment: rawBooking.data.assignedDriver
          ? `${rawBooking.data.assignedDriver.displayName} · ${rawBooking.data.selectedVehicle?.displayName ?? "Vehicle pending"}`
          : null,
        vehicleClassId: rawBooking.data.vehicleClassId,
      };

  const nextStatuses = bookingStatuses.filter((status) =>
    canTransitionBooking(booking.status, status),
  );

  const [assignableVehicles, assignableDrivers] =
    booking.type === "CAR" &&
    booking.vehicleClassId &&
    ["CONFIRMED", "DRIVER_ASSIGNED"].includes(booking.status)
      ? await Promise.all([
          db.vehicle.findMany({
            where: {
              status: "ACTIVE",
              vehicleClassId: booking.vehicleClassId,
            },
            orderBy: { displayName: "asc" },
            select: {
              id: true,
              displayName: true,
              registrationNumber: true,
            },
          }),
          db.driver.findMany({
            where: {
              status: "ACTIVE",
              qualifications: {
                some: { vehicleClassId: booking.vehicleClassId },
              },
            },
            orderBy: { displayName: "asc" },
            select: {
              id: true,
              displayName: true,
              phoneLast4: true,
              licenseExpiry: true,
            },
          }),
        ])
      : [[], []];

  const bookingId = booking.id;
  const bookingReference = booking.reference;
  const bookingType = booking.type;

  async function assignResources(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "booking.assign")) {
      redirect(`/admin/bookings/${bookingReference}`);
    }

    if (bookingType !== "CAR") {
      throw new Error("Vehicle and driver assignment is only available for car bookings.");
    }

    const vehicleId = String(formData.get("vehicleId") ?? "");
    const driverId = String(formData.get("driverId") ?? "");

    if (!vehicleId || !driverId) {
      throw new Error("Vehicle and driver are required.");
    }

    const result = await assignCarBookingResources({
      bookingId,
      vehicleId,
      driverId,
      actorUserId: currentSession.userId,
    });

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: "BOOKING_RESOURCES_ASSIGNED",
        entityType: "CarBooking",
        entityId: bookingId,
        metadata: {
          reference: bookingReference,
          vehicleName: result.vehicleName,
          driverName: result.driverName,
        },
      },
    });

    revalidatePath(`/admin/bookings/${bookingReference}`);
    revalidatePath("/admin/bookings");
  }

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

          {booking.type === "CAR" ? (
            <article className="admin-panel admin-detail-card">
              <h2>Vehicle & Driver Assignment</h2>
              {hasPermission(session.roles, "booking.assign") &&
              assignableVehicles.length > 0 &&
              assignableDrivers.length > 0 ? (
                <form action={assignResources}>
                  <label>
                    Vehicle
                    <select name="vehicleId" required defaultValue="">
                      <option value="" disabled>Select active vehicle</option>
                      {assignableVehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.displayName} · {vehicle.registrationNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Driver
                    <select name="driverId" required defaultValue="">
                      <option value="" disabled>Select qualified driver</option>
                      {assignableDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.displayName}{driver.phoneLast4 ? ` · •••• ${driver.phoneLast4}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="admin-primary-button" type="submit">
                    Assign Resources
                  </button>
                </form>
              ) : (
                <p>No assignable resources are available, or your role cannot assign bookings.</p>
              )}
            </article>
          ) : null}

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
