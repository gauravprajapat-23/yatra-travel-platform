import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {
  canTransitionBooking,
  type BookingStatus,
} from "@yatra/domain/booking/status-machine";
import { AdminShell } from "@/components/admin-shell";
import { AdminActionForm, type AdminActionState } from "@/components/admin-action-form";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { requireAdminSession } from "@/lib/auth/session";
import {
  transitionCarBookingStatus,
  transitionPackageBookingStatus,
} from "@/modules/booking/booking-status-service";

export const dynamic = "force-dynamic";

const bulkTargets = ["CANCELLED", "COMPLETED"] as const;
type BulkTarget = (typeof bulkTargets)[number];

function isBulkTarget(value: string): value is BulkTarget {
  return (bulkTargets as readonly string[]).includes(value);
}

function parseReferences(value: string) {
  return [...new Set(
    value
      .split(/[\s,;]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  )].slice(0, 50);
}

export default async function BulkBookingOperationsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.write")) redirect("/admin/bookings");

  const db = getDb();

  async function applyBulkStatus(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "booking.write")) {
      redirect("/admin/bookings");
    }

    const references = parseReferences(String(formData.get("references") ?? ""));
    const toStatusValue = String(formData.get("toStatus") ?? "");
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);

    if (references.length === 0) {
      return { status: "error", message: "Enter at least one booking reference." };
    }
    if (!isBulkTarget(toStatusValue)) {
      return { status: "error", message: "Select a supported bulk transition." };
    }

    const [cars, packages] = await Promise.all([
      db.carBooking.findMany({
        where: { reference: { in: references } },
        select: { id: true, reference: true, status: true },
      }),
      db.packageBooking.findMany({
        where: { reference: { in: references } },
        select: { id: true, reference: true, status: true },
      }),
    ]);

    const found = new Map<string, {
      id: string;
      reference: string;
      status: BookingStatus;
      type: "CAR" | "PACKAGE";
    }>();

    for (const booking of cars) {
      found.set(booking.reference, {
        ...booking,
        status: booking.status as BookingStatus,
        type: "CAR",
      });
    }
    for (const booking of packages) {
      found.set(booking.reference, {
        ...booking,
        status: booking.status as BookingStatus,
        type: "PACKAGE",
      });
    }

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const reference of references) {
      const booking = found.get(reference);
      if (!booking) {
        failed.push(`${reference}: not found`);
        continue;
      }

      if (!canTransitionBooking(booking.status, toStatusValue)) {
        failed.push(
          `${reference}: ${booking.status.replaceAll("_", " ")} cannot move to ${toStatusValue.replaceAll("_", " ")}`,
        );
        continue;
      }

      try {
        if (booking.type === "CAR") {
          await transitionCarBookingStatus({
            bookingId: booking.id,
            toStatus: toStatusValue,
            actorUserId: currentSession.userId,
            reason: reason || `Bulk operation: ${toStatusValue}`,
          });
        } else {
          await transitionPackageBookingStatus({
            bookingId: booking.id,
            toStatus: toStatusValue,
            actorUserId: currentSession.userId,
            reason: reason || `Bulk operation: ${toStatusValue}`,
          });
        }

        await db.auditLog.create({
          data: {
            actorUserId: currentSession.userId,
            action: "BOOKING_BULK_STATUS_CHANGED",
            entityType: booking.type === "CAR" ? "CarBooking" : "PackageBooking",
            entityId: booking.id,
            metadata: {
              reference,
              fromStatus: booking.status,
              toStatus: toStatusValue,
              reason: reason || null,
            },
          },
        });

        succeeded.push(reference);
      } catch (error) {
        failed.push(
          `${reference}: ${error instanceof Error ? error.message : "transition failed"}`,
        );
      }
    }

    revalidatePath("/admin/bookings");
    revalidatePath("/admin/dispatch");

    const successPart =
      succeeded.length > 0
        ? `${succeeded.length} updated: ${succeeded.join(", ")}.`
        : "No bookings were updated.";
    const failurePart =
      failed.length > 0
        ? ` ${failed.length} skipped/failed: ${failed.join(" | ")}`
        : "";

    return {
      status: failed.length === references.length ? "error" : "success",
      message: `${successPart}${failurePart}`,
    };
  }

  return (
    <AdminShell
      active="Bookings"
      title="Bulk Booking Operations"
      subtitle="Apply lifecycle-validated operational changes to up to 50 bookings at once."
      actions={
        <Link className="admin-secondary-button" href="/admin/bookings">
          ← Bookings
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <h2>Safe Bulk Status Change</h2>
        <p>
          Each booking is checked independently against the booking status
          machine and financial rules. Invalid transitions are skipped and
          reported instead of bypassing lifecycle controls.
        </p>

        <AdminActionForm action={applyBulkStatus}>
          <AdminFormGrid columns={1}>
            <AdminField
              label="Booking references"
              htmlFor="bulkBookingReferences"
              required
              hint="Up to 50 references. Separate with spaces, commas, semicolons or new lines."
            >
              <textarea
                id="bulkBookingReferences"
                name="references"
                rows={8}
                maxLength={5000}
                placeholder={"YCB-...\nYPK-..."}
                required
              />
            </AdminField>

            <AdminField label="Action" htmlFor="bulkBookingStatus" required>
              <select id="bulkBookingStatus" name="toStatus" defaultValue="" required>
                <option value="" disabled>Select action</option>
                <option value="CANCELLED">Cancel eligible bookings</option>
                <option value="COMPLETED">Complete eligible in-progress bookings</option>
              </select>
            </AdminField>

            <AdminField
              label="Operational reason"
              htmlFor="bulkBookingReason"
              hint="Stored in status history and audit log. Maximum 500 characters."
            >
              <textarea
                id="bulkBookingReason"
                name="reason"
                rows={4}
                maxLength={500}
                placeholder="Reason for this batch operation"
              />
            </AdminField>
          </AdminFormGrid>

          <AdminSubmitButton
            label="Apply to Eligible Bookings"
            pendingLabel="Applying Changes…"
          />
        </AdminActionForm>
      </section>
    </AdminShell>
  );
}
