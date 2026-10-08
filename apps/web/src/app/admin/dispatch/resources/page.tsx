import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { bookingTimeWindow, windowsOverlap } from "@yatra/domain/fleet/availability";
import { AdminField } from "@/components/admin-form";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate, formatIstDateTime } from "@/lib/admin/datetime";

export const dynamic = "force-dynamic";

const activeStatuses = ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] as const;
const allowedWindows = new Set([7, 14, 30]);

function parseWindow(value: string | undefined) {
  const parsed = Number(value ?? "14");
  return allowedWindows.has(parsed) ? parsed : 14;
}

export default async function DispatchResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const { days: rawDays } = await searchParams;
  const days = parseWindow(rawDays);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const db = getDb();

  const [vehicles, drivers] = await Promise.all([
    db.vehicle.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ vehicleClass: { sortOrder: "asc" } }, { displayName: "asc" }],
      select: {
        id: true,
        displayName: true,
        registrationNumber: true,
        vehicleClass: { select: { name: true } },
        availability: {
          where: { startsAt: { lt: horizon }, endsAt: { gt: now } },
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true, endsAt: true, reason: true },
        },
        bookings: {
          where: {
            status: { in: [...activeStatuses] },
            startsAt: { lt: horizon },
          },
          orderBy: { startsAt: "asc" },
          select: {
            reference: true,
            startsAt: true,
            endsAt: true,
            status: true,
            originText: true,
            destinationText: true,
          },
        },
      },
    }),
    db.driver.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        phoneLast4: true,
        licenseExpiry: true,
        availability: {
          where: { startsAt: { lt: horizon }, endsAt: { gt: now } },
          orderBy: { startsAt: "asc" },
          select: { id: true, startsAt: true, endsAt: true, reason: true },
        },
        bookings: {
          where: {
            status: { in: [...activeStatuses] },
            startsAt: { lt: horizon },
          },
          orderBy: { startsAt: "asc" },
          select: {
            reference: true,
            startsAt: true,
            endsAt: true,
            status: true,
            originText: true,
            destinationText: true,
          },
        },
      },
    }),
  ]);

  const vehiclesBusyNow = vehicles.filter((vehicle) =>
    vehicle.bookings.some((booking) =>
      windowsOverlap(
        bookingTimeWindow(booking.startsAt, booking.endsAt),
        { startsAt: now, endsAt: new Date(now.getTime() + 1) },
      ),
    ),
  ).length;

  const driversBusyNow = drivers.filter((driver) =>
    driver.bookings.some((booking) =>
      windowsOverlap(
        bookingTimeWindow(booking.startsAt, booking.endsAt),
        { startsAt: now, endsAt: new Date(now.getTime() + 1) },
      ),
    ),
  ).length;

  return (
    <AdminShell
      active="Dispatch"
      title="Resource Schedule"
      subtitle={`Vehicle and driver commitments for the next ${days} days.`}
      actions={
        <Link className="admin-secondary-button" href="/admin/dispatch">
          ← Dispatch Board
        </Link>
      }
    >
      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Planning window" htmlFor="resourceDays">
            <select id="resourceDays" name="days" defaultValue={days.toString()}>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
              <option value="30">Next 30 days</option>
            </select>
          </AdminField>
          <button className="admin-primary-button" type="submit">Apply Window</button>
        </form>
      </section>

      <div className="admin-metric-grid">
        <AdminMetric label="Active Vehicles" value={vehicles.length.toString()} meta={`${vehiclesBusyNow} busy now`} tone="green" />
        <AdminMetric label="Active Drivers" value={drivers.length.toString()} meta={`${driversBusyNow} busy now`} tone="blue" />
        <AdminMetric
          label="Vehicle Blocks"
          value={vehicles.reduce((sum, item) => sum + item.availability.length, 0).toString()}
          meta={`next ${days} days`}
          tone="orange"
        />
        <AdminMetric
          label="Driver Blocks"
          value={drivers.reduce((sum, item) => sum + item.availability.length, 0).toString()}
          meta={`next ${days} days`}
          tone="orange"
        />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Vehicle Schedule</h2>
          <Link href="/admin/vehicles">Fleet management →</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Class</th>
                <th>Upcoming Trips</th>
                <th>Availability Blocks</th>
                <th>Next Commitment</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr><td colSpan={5}>No active vehicles.</td></tr>
              ) : vehicles.map((vehicle) => {
                const nextBooking = vehicle.bookings.find((booking) => bookingTimeWindow(booking.startsAt, booking.endsAt).endsAt > now);
                const nextBlock = vehicle.availability.find((block) => block.endsAt > now);
                const nextCommitment = [
                  nextBooking ? { at: nextBooking.startsAt, label: `Trip ${nextBooking.reference}` } : null,
                  nextBlock ? { at: nextBlock.startsAt, label: nextBlock.reason ?? "Availability block" } : null,
                ].filter((item): item is { at: Date; label: string } => Boolean(item))
                  .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

                return (
                  <tr key={vehicle.id}>
                    <td>
                      <Link href={`/admin/vehicles/${vehicle.id}?tab=availability`}>
                        {vehicle.displayName} · {vehicle.registrationNumber}
                      </Link>
                    </td>
                    <td>{vehicle.vehicleClass.name}</td>
                    <td>
                      {vehicle.bookings.length === 0 ? "—" : vehicle.bookings.map((booking) => (
                        <div key={booking.reference}>
                          <Link href={`/admin/bookings/${booking.reference}`}>{booking.reference}</Link>
                          {" · "}{formatIstDateTime(booking.startsAt)}
                        </div>
                      ))}
                    </td>
                    <td>
                      {vehicle.availability.length === 0 ? "—" : vehicle.availability.map((block) => (
                        <div key={block.id}>{formatIstDateTime(block.startsAt)} → {formatIstDateTime(block.endsAt)}</div>
                      ))}
                    </td>
                    <td>{nextCommitment ? `${formatIstDateTime(nextCommitment.at)} · ${nextCommitment.label}` : "Free in selected window"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Driver Schedule</h2>
          <Link href="/admin/drivers">Driver management →</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>License</th>
                <th>Upcoming Trips</th>
                <th>Availability Blocks</th>
                <th>Next Commitment</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr><td colSpan={5}>No active drivers.</td></tr>
              ) : drivers.map((driver) => {
                const nextBooking = driver.bookings.find((booking) => bookingTimeWindow(booking.startsAt, booking.endsAt).endsAt > now);
                const nextBlock = driver.availability.find((block) => block.endsAt > now);
                const nextCommitment = [
                  nextBooking ? { at: nextBooking.startsAt, label: `Trip ${nextBooking.reference}` } : null,
                  nextBlock ? { at: nextBlock.startsAt, label: nextBlock.reason ?? "Availability block" } : null,
                ].filter((item): item is { at: Date; label: string } => Boolean(item))
                  .sort((a, b) => a.at.getTime() - b.at.getTime())[0];

                const licenseTone =
                  driver.licenseExpiry && driver.licenseExpiry.getTime() < now.getTime() + 30 * 24 * 60 * 60 * 1000
                    ? "orange"
                    : "green";

                return (
                  <tr key={driver.id}>
                    <td>
                      <Link href={`/admin/drivers/${driver.id}?tab=availability`}>
                        {driver.displayName}
                      </Link>
                      {driver.phoneLast4 ? ` · •••• ${driver.phoneLast4}` : ""}
                    </td>
                    <td>
                      <StatusPill tone={licenseTone}>
                        {driver.licenseExpiry ? formatIstDate(driver.licenseExpiry) : "No expiry set"}
                      </StatusPill>
                    </td>
                    <td>
                      {driver.bookings.length === 0 ? "—" : driver.bookings.map((booking) => (
                        <div key={booking.reference}>
                          <Link href={`/admin/bookings/${booking.reference}`}>{booking.reference}</Link>
                          {" · "}{formatIstDateTime(booking.startsAt)}
                        </div>
                      ))}
                    </td>
                    <td>
                      {driver.availability.length === 0 ? "—" : driver.availability.map((block) => (
                        <div key={block.id}>{formatIstDateTime(block.startsAt)} → {formatIstDateTime(block.endsAt)}</div>
                      ))}
                    </td>
                    <td>{nextCommitment ? `${formatIstDateTime(nextCommitment.at)} · ${nextCommitment.label}` : "Free in selected window"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
