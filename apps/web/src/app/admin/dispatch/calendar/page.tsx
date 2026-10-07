import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const allowedWindows = new Set([7, 14, 30]);

function parseWindow(value: string | undefined) {
  const parsed = Number(value ?? "14");
  return allowedWindows.has(parsed) ? parsed : 14;
}

function dayKey(value: Date) {
  return value.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function overlaps(startsAt: Date, endsAt: Date | null, start: Date, end: Date) {
  const fallbackEnd = new Date(startsAt.getTime() + 12 * 60 * 60 * 1000);
  return startsAt <= end && (endsAt ?? fallbackEnd) >= start;
}

export default async function FleetAvailabilityCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) redirect("/admin");

  const params = await searchParams;
  const days = parseWindow(params.days);
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const db = getDb();

  const vehicles = await db.vehicle.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ vehicleClass: { sortOrder: "asc" } }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      registrationNumber: true,
      vehicleClass: { select: { name: true } },
      availability: {
        where: { startsAt: { lt: horizon }, endsAt: { gt: now } },
        select: { id: true, startsAt: true, endsAt: true, reason: true },
      },
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
          startsAt: { lt: horizon },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: { reference: true, startsAt: true, endsAt: true },
      },
    },
  });

  const dayStarts = Array.from({ length: days }, (_, index) => {
    const cursor = new Date(now.getTime() + index * 24 * 60 * 60 * 1000);
    const key = dayKey(cursor);
    return {
      key,
      label: cursor.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      start: new Date(`${key}T00:00:00+05:30`),
      end: new Date(`${key}T23:59:59.999+05:30`),
    };
  });

  const bookedDays = vehicles.reduce(
    (sum, vehicle) =>
      sum +
      dayStarts.filter((day) =>
        vehicle.bookings.some((booking) =>
          overlaps(booking.startsAt, booking.endsAt, day.start, day.end),
        ),
      ).length,
    0,
  );

  const blockedDays = vehicles.reduce(
    (sum, vehicle) =>
      sum +
      dayStarts.filter((day) =>
        vehicle.availability.some((block) =>
          overlaps(block.startsAt, block.endsAt, day.start, day.end),
        ),
      ).length,
    0,
  );

  return (
    <AdminShell
      active="Dispatch"
      title="Fleet Availability Calendar"
      subtitle={`Vehicle availability for the next ${days} days.`}
      actions={
        <>
          <Link className="admin-secondary-button" href="/admin/dispatch/resources">
            Resource Schedule
          </Link>
          <Link className="admin-secondary-button" href="/admin/dispatch">
            Back to Dispatch
          </Link>
        </>
      }
    >
      <section className="admin-panel admin-card-body">
        <form className="admin-table-query admin-table-query--compact" method="get">
          <label>
            <span>Calendar window</span>
            <select name="days" defaultValue={days.toString()}>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
              <option value="30">Next 30 days</option>
            </select>
          </label>
          <button className="admin-primary-button" type="submit">Apply Window</button>
        </form>
      </section>

      <div className="admin-metric-grid">
        <AdminMetric label="Active Vehicles" value={vehicles.length.toString()} meta="calendar resources" tone="green" />
        <AdminMetric label="Booked Vehicle Days" value={bookedDays.toString()} meta="assigned booking days" tone="blue" />
        <AdminMetric label="Blocked Vehicle Days" value={blockedDays.toString()} meta="availability block days" tone="orange" />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Vehicle Calendar</h2>
          <small>Free, booked and blocked by IST day</small>
        </div>
        <div className="admin-availability-calendar">
          <div
            className="admin-availability-calendar__grid"
            style={{ gridTemplateColumns: `minmax(190px, 1.6fr) repeat(${days}, minmax(76px, 1fr))` }}
          >
            <div className="admin-availability-calendar__corner">Vehicle</div>
            {dayStarts.map((day) => (
              <div className="admin-availability-calendar__day" key={day.key}>
                {day.label}
              </div>
            ))}

            {vehicles.map((vehicle) => (
              <>
                <div className="admin-availability-calendar__resource" key={`${vehicle.id}-resource`}>
                  <Link href={`/admin/vehicles/${vehicle.id}?tab=availability`}>
                    {vehicle.displayName}
                  </Link>
                  <small>{vehicle.registrationNumber} · {vehicle.vehicleClass.name}</small>
                </div>

                {dayStarts.map((day) => {
                  const block = vehicle.availability.find((item) =>
                    overlaps(item.startsAt, item.endsAt, day.start, day.end),
                  );
                  const booking = vehicle.bookings.find((item) =>
                    overlaps(item.startsAt, item.endsAt, day.start, day.end),
                  );
                  const state = block ? "blocked" : booking ? "busy" : "free";

                  return (
                    <div
                      className={`admin-availability-calendar__cell admin-availability-calendar__cell--${state}`}
                      key={`${vehicle.id}-${day.key}`}
                      title={block?.reason ?? booking?.reference ?? "Free"}
                    >
                      {booking ? (
                        <Link href={`/admin/bookings/${booking.reference}`}>{booking.reference}</Link>
                      ) : (
                        <span>{block ? "Blocked" : "Free"}</span>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
