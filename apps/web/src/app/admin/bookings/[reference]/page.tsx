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
import {
  bookingTimeWindow,
  credentialValidThrough,
  windowsOverlap,
} from "@yatra/domain/fleet/availability";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminActionForm, type AdminActionState } from "@/components/admin-action-form";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate, formatIstDateTime } from "@/lib/admin/datetime";
import {
  transitionCarBookingStatus,
  transitionPackageBookingStatus,
} from "@/modules/booking/booking-status-service";
import { assignCarBookingResources } from "@/modules/booking/car-assignment-service";
import { createRefundRequest } from "@/modules/payments/refund-service";

export const dynamic = "force-dynamic";

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
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const { reference: rawReference } = await params;
  const { tab: requestedTab } = await searchParams;
  const reference = rawReference.trim().toUpperCase();
  const activeTab = ["overview", "payments", "operations", "timeline"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
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

  const hasCapturedPayment = booking.paymentIntents.some(
    (intent) =>
      ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(intent.status) &&
      intent.amountPaidMinor >= booking.totalMinor,
  );

  const paidMinor = booking.paymentIntents.reduce(
    (sum, intent) => sum + intent.amountPaidMinor,
    0n,
  );
  const pendingRefundMinor = booking.paymentIntents.reduce(
    (sum, intent) =>
      sum +
      intent.refunds
        .filter((refund) => refund.status === "PENDING")
        .reduce((refundSum, refund) => refundSum + refund.amountMinor, 0n),
    0n,
  );
  const processedRefundMinor = booking.paymentIntents.reduce(
    (sum, intent) =>
      sum +
      intent.refunds
        .filter((refund) => refund.status === "PROCESSED")
        .reduce((refundSum, refund) => refundSum + refund.amountMinor, 0n),
    0n,
  );
  const netPaidMinor = paidMinor - processedRefundMinor;

  type TimelineTone = "green" | "orange" | "red" | "blue" | "gray";
  type TimelineEvent = {
    key: string;
    at: Date;
    title: string;
    detail: string;
    tone: TimelineTone;
  };

  const timelineEvents = [
    ...booking.history.map((entry) => ({
      key: `status-${entry.id.toString()}`,
      at: entry.createdAt,
      title: entry.toStatus.replaceAll("_", " "),
      detail: entry.reason ?? "Booking status updated.",
      tone: tone(entry.toStatus),
    })),
    ...booking.paymentIntents.flatMap((intent) => {
      const paymentEvents: TimelineEvent[] = [{
        key: `payment-created-${intent.id}`,
        at: intent.createdAt,
        title: "PAYMENT INTENT CREATED",
        detail: `${money(intent.amountMinor, intent.currency)} · ${intent.providerOrderId ?? "provider order pending"}`,
        tone: "orange",
      }];

      if (intent.capturedAt) {
        paymentEvents.push({
          key: `payment-captured-${intent.id}`,
          at: intent.capturedAt,
          title: "PAYMENT CAPTURED",
          detail: money(intent.amountPaidMinor, intent.currency),
          tone: "green",
        });
      }

      if (intent.failedAt) {
        paymentEvents.push({
          key: `payment-failed-${intent.id}`,
          at: intent.failedAt,
          title: "PAYMENT FAILED",
          detail: intent.providerOrderId ?? "Payment provider failure",
          tone: "red",
        });
      }

      return [
        ...paymentEvents,
        ...intent.refunds.map((refund) => ({
          key: `refund-${refund.id}`,
          at: refund.processedAt ?? refund.createdAt,
          title: `REFUND ${refund.status.replaceAll("_", " ")}`,
          detail: `${money(refund.amountMinor, refund.currency)}${refund.reason ? ` · ${refund.reason}` : ""}`,
          tone:
            refund.status === "PROCESSED"
              ? ("green" as const)
              : refund.status === "FAILED"
                ? ("red" as const)
                : ("orange" as const),
        })),
      ];
    }),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const nextStatuses = bookingStatuses.filter(
    (status) =>
      canTransitionBooking(booking.status, status) &&
      !["REFUND_PENDING", "REFUNDED"].includes(status) &&
      !(
        status === "CONFIRMED" &&
        booking.totalMinor > 0n &&
        !hasCapturedPayment
      ),
  );

  const assignmentWindow =
    booking.type === "CAR"
      ? bookingTimeWindow(booking.startsAt, booking.endsAt)
      : null;

  const [vehicleCandidates, driverCandidates] =
    booking.type === "CAR" &&
    booking.vehicleClassId &&
    assignmentWindow &&
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
              availability: {
                where: {
                  startsAt: { lt: assignmentWindow.endsAt },
                  endsAt: { gt: assignmentWindow.startsAt },
                },
                select: { id: true, reason: true },
              },
              bookings: {
                where: {
                  id: { not: booking.id },
                  status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
                  startsAt: { lt: assignmentWindow.endsAt },
                },
                select: {
                  reference: true,
                  startsAt: true,
                  endsAt: true,
                },
              },
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
              availability: {
                where: {
                  startsAt: { lt: assignmentWindow.endsAt },
                  endsAt: { gt: assignmentWindow.startsAt },
                },
                select: { id: true, reason: true },
              },
              bookings: {
                where: {
                  id: { not: booking.id },
                  status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
                  startsAt: { lt: assignmentWindow.endsAt },
                },
                select: {
                  reference: true,
                  startsAt: true,
                  endsAt: true,
                },
              },
            },
          }),
        ])
      : [[], []];

  const vehicleAvailability = vehicleCandidates.map((vehicle) => {
    const conflictingBooking = assignmentWindow
      ? vehicle.bookings.find((other) =>
          windowsOverlap(
            assignmentWindow,
            bookingTimeWindow(other.startsAt, other.endsAt),
          ),
        )
      : undefined;
    const reason = vehicle.availability[0]?.reason
      ? `Blocked: ${vehicle.availability[0].reason}`
      : vehicle.availability.length > 0
        ? "Blocked by an availability window"
        : conflictingBooking
          ? `Overlaps booking ${conflictingBooking.reference}`
          : null;

    return { ...vehicle, conflictReason: reason };
  });

  const driverAvailability = driverCandidates.map((driver) => {
    const conflictingBooking = assignmentWindow
      ? driver.bookings.find((other) =>
          windowsOverlap(
            assignmentWindow,
            bookingTimeWindow(other.startsAt, other.endsAt),
          ),
        )
      : undefined;
    const licenseInvalid =
      assignmentWindow &&
      !credentialValidThrough(driver.licenseExpiry, assignmentWindow.endsAt);
    const reason = licenseInvalid
      ? "License does not remain valid through this trip"
      : driver.availability[0]?.reason
        ? `Blocked: ${driver.availability[0].reason}`
        : driver.availability.length > 0
          ? "Blocked by an availability window"
          : conflictingBooking
            ? `Overlaps booking ${conflictingBooking.reference}`
            : null;

    return { ...driver, conflictReason: reason };
  });

  const assignableVehicles = vehicleAvailability.filter(
    (vehicle) => !vehicle.conflictReason,
  );
  const unavailableVehicles = vehicleAvailability.filter(
    (vehicle) => Boolean(vehicle.conflictReason),
  );
  const assignableDrivers = driverAvailability.filter(
    (driver) => !driver.conflictReason,
  );
  const unavailableDrivers = driverAvailability.filter(
    (driver) => Boolean(driver.conflictReason),
  );

  const bookingId = booking.id;
  const bookingReference = booking.reference;
  const bookingType = booking.type;

  async function assignResources(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "booking.assign")) {
      redirect(`/admin/bookings/${bookingReference}`);
    }

    if (bookingType !== "CAR") {
      return {
        status: "error",
        message: "Vehicle and driver assignment is only available for car bookings.",
      };
    }

    const vehicleId = String(formData.get("vehicleId") ?? "");
    const driverId = String(formData.get("driverId") ?? "");

    if (!vehicleId || !driverId) {
      return {
        status: "error",
        message: "Select both a vehicle and a driver.",
      };
    }

    try {
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
    } catch {
      return {
        status: "error",
        message:
          "Unable to assign those resources. They may no longer be available for this trip window.",
      };
    }

    revalidatePath(`/admin/bookings/${bookingReference}`);
    revalidatePath("/admin/bookings");

    return {
      status: "success",
      message: "Vehicle and driver assigned successfully.",
    };
  }

  async function refundRemainingPayment(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "refund.manage")) {
      redirect(`/admin/bookings/${bookingReference}`);
    }

    const paymentIntentId = String(formData.get("paymentIntentId") ?? "");
    if (!paymentIntentId) {
      throw new Error("Payment intent is required.");
    }

    const paymentIntent = await db.paymentIntent.findUnique({
      where: { id: paymentIntentId },
      include: {
        refunds: {
          where: { status: { in: ["PENDING", "PROCESSED"] } },
          select: { amountMinor: true },
        },
      },
    });

    if (!paymentIntent) {
      throw new Error("Payment intent not found.");
    }

    const belongsToBooking =
      (bookingType === "CAR" &&
        paymentIntent.carBookingId === bookingId &&
        paymentIntent.packageBookingId === null) ||
      (bookingType === "PACKAGE" &&
        paymentIntent.packageBookingId === bookingId &&
        paymentIntent.carBookingId === null);

    if (!belongsToBooking) {
      throw new Error("Payment intent does not belong to this booking.");
    }

    if (!["CAPTURED", "PARTIALLY_REFUNDED"].includes(paymentIntent.status)) {
      throw new Error("Payment is not refundable.");
    }

    const reservedMinor = paymentIntent.refunds.reduce(
      (sum, refund) => sum + refund.amountMinor,
      0n,
    );
    const remainingMinor = paymentIntent.amountPaidMinor - reservedMinor;

    if (remainingMinor <= 0n) {
      throw new Error("No refundable balance remains.");
    }

    const refundableBookingStates: BookingStatus[] = [
      "CONFIRMED",
      "DRIVER_ASSIGNED",
      "COMPLETED",
      "CANCELLED",
    ];

    if (!refundableBookingStates.includes(booking.status)) {
      throw new Error("Booking is not in a refundable operational state.");
    }

    const result = await createRefundRequest({
      paymentIntentId: paymentIntent.id,
      amountMinor: remainingMinor,
      idempotencyKey: `admin-refund-${paymentIntent.id}-${remainingMinor.toString()}`,
      reason: `Full remaining refund requested by admin for booking ${bookingReference}.`,
    });

    if (bookingType === "CAR") {
      await transitionCarBookingStatus({
        bookingId,
        toStatus: "REFUND_PENDING",
        actorUserId: currentSession.userId,
        reason: "Full remaining payment refund requested.",
      });
    } else {
      await transitionPackageBookingStatus({
        bookingId,
        toStatus: "REFUND_PENDING",
        actorUserId: currentSession.userId,
        reason: "Full remaining payment refund requested.",
      });
    }

    await db.auditLog.create({
      data: {
        actorUserId: currentSession.userId,
        action: "BOOKING_REFUND_REQUESTED",
        entityType: bookingType === "CAR" ? "CarBooking" : "PackageBooking",
        entityId: bookingId,
        metadata: {
          reference: bookingReference,
          paymentIntentId: paymentIntent.id,
          refundId: result.refundId,
          amountMinor: remainingMinor.toString(),
          currency: paymentIntent.currency,
        },
      },
    });

    revalidatePath(`/admin/bookings/${bookingReference}`);
    revalidatePath("/admin/bookings");
    revalidatePath("/admin/payments");
  }

  async function updateStatus(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "booking.write")) {
      redirect("/admin/bookings");
    }

    const toStatusValue = String(formData.get("toStatus") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();

    if (!isBookingStatus(toStatusValue)) {
      return {
        status: "error",
        message: "Select a valid next booking status.",
      };
    }

    try {
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
    } catch {
      return {
        status: "error",
        message:
          "Unable to update the booking status. Refresh the booking and try the transition again.",
      };
    }

    revalidatePath(`/admin/bookings/${booking.reference}`);
    revalidatePath("/admin/bookings");

    return {
      status: "success",
      message: `Booking moved to ${toStatusValue.replaceAll("_", " ")}.`,
    };
  }

  return (
    <AdminShell
      active="Bookings"
      title={`Booking #${booking.reference}`}
      subtitle={`${booking.type === "CAR" ? "Car booking" : "Package booking"} · created ${formatIstDateTime(booking.createdAt)}`}
      actions={
        <Link className="admin-secondary-button" href="/admin/bookings">
          ← All Bookings
        </Link>
      }
    >
      <AdminEditorTabs
        basePath={`/admin/bookings/${booking.reference}`}
        active={activeTab}
        tabs={[
          {
            key: "overview",
            label: "Overview",
            description: "Trip & customer",
            badge: booking.status.replaceAll("_", " "),
          },
          {
            key: "payments",
            label: "Payments",
            description: "Captured & refunds",
            badge: String(booking.paymentIntents.length),
            badgeTone:
              booking.paymentIntents.length > 0 ? "success" : "neutral",
          },
          {
            key: "operations",
            label: "Operations",
            description: "Status & assignment",
            badge:
              booking.type === "CAR"
                ? booking.assignment
                  ? "Assigned"
                  : "Unassigned"
                : "Package",
            badgeTone:
              booking.type === "CAR"
                ? booking.assignment
                  ? "success"
                  : "warning"
                : "neutral",
          },
          {
            key: "timeline",
            label: "Timeline",
            description: "Audit history",
            badge: String(timelineEvents.length),
          },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <>
            <section className="admin-panel admin-detail-card">
              <div className="admin-panel-heading">
                <h2>Trip Overview</h2>
                <StatusPill tone={tone(booking.status)}>
                  {booking.status.replaceAll("_", " ")}
                </StatusPill>
              </div>
              <h3>{booking.title}</h3>
              <p>{booking.route}</p>
              <dl>
                <div><dt>Departure</dt><dd>{formatIstDate(booking.startsAt)}</dd></div>
                <div><dt>Return</dt><dd>{booking.endsAt ? formatIstDate(booking.endsAt) : "As per booking"}</dd></div>
                <div><dt>Travellers</dt><dd>{booking.travellers}</dd></div>
                <div><dt>Assignment</dt><dd>{booking.assignment ?? "Not assigned"}</dd></div>
              </dl>
              <div className="admin-amount-card">
                <span>Total Amount</span>
                <strong>{money(booking.totalMinor, booking.currency)}</strong>
              </div>
            </section>

            <section className="admin-panel admin-detail-card">
              <h2>Customer</h2>
              <dl>
                <div><dt>Name</dt><dd>{booking.guestName ?? "Account customer"}</dd></div>
                <div><dt>Email</dt><dd>{booking.guestEmail ?? "Not available"}</dd></div>
                <div><dt>Reference</dt><dd>{booking.reference}</dd></div>
                <div><dt>Booking type</dt><dd>{booking.type}</dd></div>
              </dl>
            </section>
          </>
        ) : null}

        {activeTab === "payments" ? (
          <>
            <section className="admin-panel admin-detail-card">
              <h2>Financial & Cancellation Summary</h2>
              <dl>
                <div><dt>Booking total</dt><dd>{money(booking.totalMinor, booking.currency)}</dd></div>
                <div><dt>Captured / paid</dt><dd>{money(paidMinor, booking.currency)}</dd></div>
                <div><dt>Pending refunds</dt><dd>{money(pendingRefundMinor, booking.currency)}</dd></div>
                <div><dt>Processed refunds</dt><dd>{money(processedRefundMinor, booking.currency)}</dd></div>
                <div><dt>Net paid</dt><dd>{money(netPaidMinor, booking.currency)}</dd></div>
                <div><dt>Cancellation state</dt><dd>{booking.status === "CANCELLED" ? "Cancelled" : "Not cancelled"}</dd></div>
              </dl>

              {booking.status === "CANCELLED" && processedRefundMinor < paidMinor ? (
                <p>
                  This booking is cancelled with an unreconciled paid balance of{" "}
                  <strong>{money(paidMinor - processedRefundMinor, booking.currency)}</strong>.
                </p>
              ) : null}

              {booking.status === "REFUND_PENDING" ? (
                <p>
                  Refund processing is still pending. Review payment activity
                  before further action.
                </p>
              ) : null}
            </section>

            <section className="admin-panel admin-detail-card">
              <h2>Payment Activity</h2>
              {booking.paymentIntents.length === 0 ? (
                <p>No payment intent has been created yet.</p>
              ) : booking.paymentIntents.map((intent) => {
                const reservedMinor = intent.refunds
                  .filter((refund) => ["PENDING", "PROCESSED"].includes(refund.status))
                  .reduce((sum, refund) => sum + refund.amountMinor, 0n);
                const remainingMinor = intent.amountPaidMinor - reservedMinor;
                const canRefund =
                  hasPermission(session.roles, "refund.manage") &&
                  ["CAPTURED", "PARTIALLY_REFUNDED"].includes(intent.status) &&
                  remainingMinor > 0n &&
                  ["CONFIRMED", "DRIVER_ASSIGNED", "COMPLETED", "CANCELLED"].includes(booking.status);

                return (
                  <div key={intent.id}>
                    <strong>{intent.status.replaceAll("_", " ")}</strong>
                    <p>
                      {money(
                        intent.amountPaidMinor > 0n
                          ? intent.amountPaidMinor
                          : intent.amountMinor,
                        intent.currency,
                      )}
                      {" · "}
                      {intent.providerOrderId ?? "No provider order"}
                    </p>

                    {intent.refunds.map((refund) => (
                      <small key={refund.id}>
                        Refund {refund.status}: {money(refund.amountMinor, refund.currency)}
                      </small>
                    ))}

                    {canRefund ? (
                      <form action={refundRemainingPayment}>
                        <input
                          type="hidden"
                          name="paymentIntentId"
                          value={intent.id}
                        />
                        <AdminSubmitButton
                          className="admin-danger-button"
                          label={`Refund Remaining ${money(remainingMinor, intent.currency)}`}
                          pendingLabel="Requesting Refund…"
                        />
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </section>
          </>
        ) : null}

        {activeTab === "operations" ? (
          <>
            <section className="admin-panel admin-detail-card">
              <h2>Change Status</h2>
              {hasPermission(session.roles, "booking.write") &&
              nextStatuses.length > 0 ? (
                <AdminActionForm action={updateStatus}>
                  <AdminFormGrid columns={1}>
                    <AdminField
                      label="Next status"
                      htmlFor="bookingNextStatus"
                      required
                    >
                      <select
                        id="bookingNextStatus"
                        name="toStatus"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>Select status</option>
                        {nextStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </AdminField>

                    <AdminField
                      label="Reason"
                      htmlFor="bookingStatusReason"
                      hint="Optional operational note stored in the audit trail."
                    >
                      <textarea
                        id="bookingStatusReason"
                        name="reason"
                        maxLength={500}
                        rows={4}
                        placeholder="Operational note for the audit trail"
                      />
                    </AdminField>
                  </AdminFormGrid>

                  <AdminSubmitButton
                    label="Update Status"
                    pendingLabel="Updating Status…"
                  />
                </AdminActionForm>
              ) : (
                <p>
                  No manual status transition is available for your role or the
                  current state.
                </p>
              )}
            </section>

            {booking.type === "CAR" ? (
              <section className="admin-panel admin-detail-card">
                <h2>Vehicle & Driver Assignment</h2>
                <p>
                  Availability is previewed for this trip window before
                  submission. The assignment transaction re-checks all
                  conflicts server-side.
                </p>

                {unavailableVehicles.length > 0 ||
                unavailableDrivers.length > 0 ? (
                  <div className="admin-assignment-conflicts">
                    {unavailableVehicles.length > 0 ? (
                      <div>
                        <strong>Unavailable vehicles</strong>
                        {unavailableVehicles.map((vehicle) => (
                          <small key={vehicle.id}>
                            {vehicle.displayName} · {vehicle.registrationNumber}
                            {" — "}
                            {vehicle.conflictReason}
                          </small>
                        ))}
                      </div>
                    ) : null}

                    {unavailableDrivers.length > 0 ? (
                      <div>
                        <strong>Unavailable drivers</strong>
                        {unavailableDrivers.map((driver) => (
                          <small key={driver.id}>
                            {driver.displayName} — {driver.conflictReason}
                          </small>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {hasPermission(session.roles, "booking.assign") &&
                assignableVehicles.length > 0 &&
                assignableDrivers.length > 0 ? (
                  <AdminActionForm action={assignResources}>
                    <AdminFormGrid columns={1}>
                      <AdminField
                        label="Vehicle"
                        htmlFor="bookingVehicle"
                        required
                      >
                        <select
                          id="bookingVehicle"
                          name="vehicleId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>Select active vehicle</option>
                          {assignableVehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.displayName} · {vehicle.registrationNumber}
                            </option>
                          ))}
                        </select>
                      </AdminField>

                      <AdminField
                        label="Driver"
                        htmlFor="bookingDriver"
                        required
                      >
                        <select
                          id="bookingDriver"
                          name="driverId"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select qualified driver
                          </option>
                          {assignableDrivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.displayName}
                              {driver.phoneLast4
                                ? ` · •••• ${driver.phoneLast4}`
                                : ""}
                            </option>
                          ))}
                        </select>
                      </AdminField>
                    </AdminFormGrid>

                    <AdminSubmitButton
                      label="Assign Resources"
                      pendingLabel="Assigning Resources…"
                    />
                  </AdminActionForm>
                ) : (
                  <p>
                    No assignable resources are available, or your role cannot
                    assign bookings.
                  </p>
                )}
              </section>
            ) : null}
          </>
        ) : null}

        {activeTab === "timeline" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Operational Timeline</h2>
            <p>
              Status, payment and refund events are shown together, newest first.
            </p>
            <div className="admin-timeline">
              {timelineEvents.length === 0 ? (
                <p>No operational events recorded yet.</p>
              ) : timelineEvents.map((entry) => (
                <div key={entry.key}>
                  <span>✓</span>
                  <div>
                    <strong>
                      <StatusPill tone={entry.tone}>
                        {entry.title}
                      </StatusPill>
                    </strong>
                    <small>{formatIstDateTime(entry.at)}</small>
                    <p>{entry.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
