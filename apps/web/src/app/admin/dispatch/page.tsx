import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminField } from "@/components/admin-form";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDate, formatIstDateTime } from "@/lib/admin/datetime";

export const dynamic = "force-dynamic";

const allowedWindows = new Set([7, 14, 30]);
const allowedAlertHours = new Set([6, 12, 24, 48]);

function parseWindow(value: string | undefined) {
  const parsed = Number(value ?? "14");
  return allowedWindows.has(parsed) ? parsed : 14;
}

function parseAlertHours(value: string | undefined) {
  const parsed = Number(value ?? "24");
  return allowedAlertHours.has(parsed) ? parsed : 24;
}

function bookingTone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "CONFIRMED") return "green";
  if (["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(status)) return "blue";
  if (["PENDING_PAYMENT", "PENDING_REVIEW", "REFUND_PENDING"].includes(status)) return "orange";
  if (["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(status)) return "red";
  return "gray";
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; alertHours?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const params = await searchParams;
  const days = parseWindow(params.days);
  const alertHours = parseAlertHours(params.alertHours);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const licenseAlertThrough = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const db = getDb();

  const [
    unassigned,
    upcomingAssigned,
    inProgress,
    vehicleBlocks,
    driverBlocks,
    expiringLicenses,
    maintenanceVehicles,
    activeVehicles,
    activeDrivers,
  ] = await Promise.all([
    db.carBooking.findMany({
      where: {
        status: "CONFIRMED",
        startsAt: { gte: now, lte: horizon },
        OR: [{ selectedVehicleId: null }, { assignedDriverId: null }],
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        endsAt: true,
        travellers: true,
        vehicleClass: { select: { name: true } },
      },
    }),
    db.carBooking.findMany({
      where: {
        status: "DRIVER_ASSIGNED",
        startsAt: { gte: now, lte: horizon },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        endsAt: true,
        status: true,
        selectedVehicle: {
          select: { displayName: true, registrationNumber: true },
        },
        assignedDriver: {
          select: { displayName: true, phoneLast4: true },
        },
      },
    }),
    db.carBooking.findMany({
      where: { status: "IN_PROGRESS" },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        endsAt: true,
        selectedVehicle: {
          select: { displayName: true, registrationNumber: true },
        },
        assignedDriver: {
          select: { displayName: true, phoneLast4: true },
        },
      },
    }),
    db.vehicleAvailabilityBlock.findMany({
      where: {
        startsAt: { lt: horizon },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      include: {
        vehicle: {
          select: { displayName: true, registrationNumber: true, status: true },
        },
      },
    }),
    db.driverAvailabilityBlock.findMany({
      where: {
        startsAt: { lt: horizon },
        endsAt: { gt: now },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
      include: {
        driver: {
          select: { displayName: true, status: true, phoneLast4: true },
        },
      },
    }),
    db.driver.findMany({
      where: {
        status: "ACTIVE",
        licenseExpiry: { gte: now, lte: licenseAlertThrough },
      },
      orderBy: { licenseExpiry: "asc" },
      take: 50,
      select: {
        id: true,
        displayName: true,
        licenseExpiry: true,
        phoneLast4: true,
      },
    }),
    db.vehicle.findMany({
      where: { status: "MAINTENANCE" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        displayName: true,
        registrationNumber: true,
        updatedAt: true,
        vehicleClass: { select: { name: true } },
      },
    }),
    db.vehicle.count({ where: { status: "ACTIVE" } }),
    db.driver.count({ where: { status: "ACTIVE" } }),
  ]);

  const alertThrough = new Date(now.getTime() + alertHours * 60 * 60 * 1000);
  const nearDepartures = [
    ...unassigned.map((booking) => ({
      reference: booking.reference,
      startsAt: booking.startsAt,
      route: `${booking.originText} → ${booking.destinationText}`,
      readiness: "Needs assignment",
      tone: "orange" as const,
    })),
    ...upcomingAssigned.map((booking) => ({
      reference: booking.reference,
      startsAt: booking.startsAt,
      route: `${booking.originText} → ${booking.destinationText}`,
      readiness: "Assigned",
      tone: "green" as const,
    })),
  ]
    .filter((booking) => booking.startsAt <= alertThrough)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const operationalAlerts = [
    ...(unassigned.length > 0
      ? [{
          label: `${unassigned.length} confirmed trip${unassigned.length === 1 ? "" : "s"} still need vehicle/driver assignment.`,
          href: "#unassigned",
          tone: "orange" as const,
        }]
      : []),
    ...(expiringLicenses.length > 0
      ? [{
          label: `${expiringLicenses.length} active driver license${expiringLicenses.length === 1 ? "" : "s"} expire within 30 days.`,
          href: "#license-alerts",
          tone: "red" as const,
        }]
      : []),
    ...(maintenanceVehicles.length > 0
      ? [{
          label: `${maintenanceVehicles.length} vehicle${maintenanceVehicles.length === 1 ? "" : "s"} currently marked MAINTENANCE and excluded from active dispatch resources.`,
          href: "#maintenance-alerts",
          tone: "orange" as const,
        }]
      : []),
    ...((vehicleBlocks.length + driverBlocks.length) > 0
      ? [{
          label: `${vehicleBlocks.length + driverBlocks.length} availability block${vehicleBlocks.length + driverBlocks.length === 1 ? "" : "s"} overlap the next ${days} days.`,
          href: "#availability",
          tone: "blue" as const,
        }]
      : []),
  ];

  return (
    <AdminShell
      active="Dispatch"
      title="Dispatch"
      subtitle={`Operational assignment and availability board for the next ${days} days.`}
      actions={
        <>
          <Link className="admin-secondary-button" href="/admin/dispatch/resources">
            Resource Schedule
          </Link>
          <Link className="admin-secondary-button" href="/admin/dispatch/calendar">
            Availability Calendar
          </Link>
          <Link className="admin-secondary-button" href="/admin/bookings">
            All Bookings
          </Link>
        </>
      }
    >
      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <AdminField label="Planning window" htmlFor="dispatchDays">
            <select id="dispatchDays" name="days" defaultValue={days.toString()}>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
              <option value="30">Next 30 days</option>
            </select>
          </AdminField>
          <AdminField label="Departure alert" htmlFor="dispatchAlertHours">
            <select
              id="dispatchAlertHours"
              name="alertHours"
              defaultValue={alertHours.toString()}
            >
              <option value="6">Next 6 hours</option>
              <option value="12">Next 12 hours</option>
              <option value="24">Next 24 hours</option>
              <option value="48">Next 48 hours</option>
            </select>
          </AdminField>
          <button className="admin-primary-button" type="submit">
            Apply Window
          </button>
        </form>
      </section>

      <div className="admin-metric-grid">
        <AdminMetric
          label="Needs Assignment"
          value={unassigned.length.toString()}
          meta={`confirmed departures in next ${days} days`}
          tone={unassigned.length > 0 ? "orange" : "green"}
        />
        <AdminMetric
          label="Upcoming Assigned"
          value={upcomingAssigned.length.toString()}
          meta="vehicle + driver allocated"
          tone="blue"
        />
        <AdminMetric
          label="Trips In Progress"
          value={inProgress.length.toString()}
          meta="live operational state"
          tone="green"
        />
        <AdminMetric
          label="Active Resources"
          value={`${activeVehicles} / ${activeDrivers}`}
          meta="vehicles / drivers"
          tone="green"
        />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Operational Alerts</h2>
        </div>
        <div className="admin-card-body">
          {operationalAlerts.length === 0 ? (
            <p>No dispatch alerts in the selected planning window.</p>
          ) : (
            operationalAlerts.map((alert) => (
              <p key={alert.label}>
                <StatusPill tone={alert.tone}>Attention</StatusPill>{" "}
                <a href={alert.href}>{alert.label}</a>
              </p>
            ))
          )}
        </div>
      </section>

      <section className="admin-panel" id="near-departures">
        <div className="admin-panel-heading">
          <h2>Near-Term Departures</h2>
          <small>Trips leaving within the next {alertHours} hours</small>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Departure</th>
                <th>Booking</th>
                <th>Route</th>
                <th>Readiness</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {nearDepartures.length === 0 ? (
                <tr><td colSpan={5}>No departures within the selected alert window.</td></tr>
              ) : nearDepartures.map((booking) => (
                <tr key={booking.reference}>
                  <td>{formatIstDateTime(booking.startsAt)}</td>
                  <td><Link href={`/admin/bookings/${booking.reference}`}>{booking.reference}</Link></td>
                  <td>{booking.route}</td>
                  <td><StatusPill tone={booking.tone}>{booking.readiness}</StatusPill></td>
                  <td><Link href={`/admin/bookings/${booking.reference}`}>Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel" id="unassigned">
        <div className="admin-panel-heading">
          <h2>Confirmed Trips Needing Assignment</h2>
          <Link href="/admin/bookings?type=CAR&status=CONFIRMED">Open booking queue →</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Departure</th>
                <th>Booking</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Class</th>
                <th>Travellers</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {unassigned.length === 0 ? (
                <tr>
                  <td colSpan={7}>All confirmed car trips in this window are assigned.</td>
                </tr>
              ) : (
                unassigned.map((booking) => (
                  <tr key={booking.reference}>
                    <td>{formatIstDateTime(booking.startsAt)}</td>
                    <td>
                      <Link href={`/admin/bookings/${booking.reference}`}>
                        {booking.reference}
                      </Link>
                    </td>
                    <td>{booking.guestName ?? "Account customer"}</td>
                    <td>{booking.originText} → {booking.destinationText}</td>
                    <td>{booking.vehicleClass.name}</td>
                    <td>{booking.travellers}</td>
                    <td>
                      <Link href={`/admin/bookings/${booking.reference}`}>
                        Assign →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Upcoming Assigned Trips</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Departure</th>
                <th>Booking</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAssigned.length === 0 ? (
                <tr>
                  <td colSpan={6}>No assigned departures in this window.</td>
                </tr>
              ) : (
                upcomingAssigned.map((booking) => (
                  <tr key={booking.reference}>
                    <td>{formatIstDateTime(booking.startsAt)}</td>
                    <td>
                      <Link href={`/admin/bookings/${booking.reference}`}>
                        {booking.reference}
                      </Link>
                    </td>
                    <td>{booking.originText} → {booking.destinationText}</td>
                    <td>
                      {booking.selectedVehicle
                        ? `${booking.selectedVehicle.displayName} · ${booking.selectedVehicle.registrationNumber}`
                        : "Not assigned"}
                    </td>
                    <td>
                      {booking.assignedDriver
                        ? `${booking.assignedDriver.displayName}${booking.assignedDriver.phoneLast4 ? ` · •••• ${booking.assignedDriver.phoneLast4}` : ""}`
                        : "Not assigned"}
                    </td>
                    <td><StatusPill tone={bookingTone(booking.status)}>Driver assigned</StatusPill></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Trips In Progress</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {inProgress.length === 0 ? (
                <tr>
                  <td colSpan={6}>No trips are currently marked in progress.</td>
                </tr>
              ) : (
                inProgress.map((booking) => (
                  <tr key={booking.reference}>
                    <td>
                      <Link href={`/admin/bookings/${booking.reference}`}>
                        {booking.reference}
                      </Link>
                    </td>
                    <td>{booking.guestName ?? "Account customer"}</td>
                    <td>{booking.originText} → {booking.destinationText}</td>
                    <td>
                      {booking.selectedVehicle
                        ? `${booking.selectedVehicle.displayName} · ${booking.selectedVehicle.registrationNumber}`
                        : "Not assigned"}
                    </td>
                    <td>{booking.assignedDriver?.displayName ?? "Not assigned"}</td>
                    <td>{formatIstDateTime(booking.startsAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-dashboard-grid admin-dashboard-grid--tables" id="availability">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Vehicle Blocks</h2>
            <Link href="/admin/vehicles">Fleet →</Link>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Blocked From</th>
                <th>Until</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {vehicleBlocks.length === 0 ? (
                <tr><td colSpan={4}>No vehicle blocks in this window.</td></tr>
              ) : vehicleBlocks.map((block) => (
                <tr key={block.id}>
                  <td>{block.vehicle.displayName} · {block.vehicle.registrationNumber}</td>
                  <td>{formatIstDateTime(block.startsAt)}</td>
                  <td>{formatIstDateTime(block.endsAt)}</td>
                  <td>{block.reason ?? "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Driver Blocks</h2>
            <Link href="/admin/drivers">Drivers →</Link>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Blocked From</th>
                <th>Until</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {driverBlocks.length === 0 ? (
                <tr><td colSpan={4}>No driver blocks in this window.</td></tr>
              ) : driverBlocks.map((block) => (
                <tr key={block.id}>
                  <td>
                    {block.driver.displayName}
                    {block.driver.phoneLast4 ? ` · •••• ${block.driver.phoneLast4}` : ""}
                  </td>
                  <td>{formatIstDateTime(block.startsAt)}</td>
                  <td>{formatIstDateTime(block.endsAt)}</td>
                  <td>{block.reason ?? "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="admin-panel" id="maintenance-alerts">
        <div className="admin-panel-heading">
          <h2>Vehicle Maintenance Alerts</h2>
          <Link href="/admin/vehicles">Fleet Management →</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Registration</th>
                <th>Class</th>
                <th>Status Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceVehicles.length === 0 ? (
                <tr><td colSpan={5}>No vehicles are currently marked for maintenance.</td></tr>
              ) : maintenanceVehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.displayName}</td>
                  <td>{vehicle.registrationNumber}</td>
                  <td>{vehicle.vehicleClass.name}</td>
                  <td>{formatIstDateTime(vehicle.updatedAt)}</td>
                  <td><Link href={`/admin/vehicles/${vehicle.id}`}>Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel" id="license-alerts">
        <div className="admin-panel-heading">
          <h2>Driver License Alerts</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Phone</th>
                <th>License Expiry</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {expiringLicenses.length === 0 ? (
                <tr><td colSpan={4}>No active driver licenses expire within 30 days.</td></tr>
              ) : expiringLicenses.map((driver) => (
                <tr key={driver.id}>
                  <td>{driver.displayName}</td>
                  <td>{driver.phoneLast4 ? `•••• ${driver.phoneLast4}` : "Not available"}</td>
                  <td>{driver.licenseExpiry ? formatIstDate(driver.licenseExpiry) : "Not set"}</td>
                  <td><Link href={`/admin/drivers/${driver.id}`}>Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
