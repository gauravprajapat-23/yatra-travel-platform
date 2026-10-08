import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@yatra/db/client";
import { BookingLookup } from "@/components/booking-lookup";
import { getCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Trips",
  robots: { index: false, follow: false },
};

function money(minor: bigint, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tripDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function MyTripsPage() {
  const session = await getCustomerSession();

  if (!session) {
    return (
      <>
        <section className="story-hero story-hero--my-trips">
          <div className="story-hero__overlay" />
          <div className="shell story-hero__content">
            <h1>My Trips.</h1>
            <p>
              Sign in for your account-linked journeys, or securely look up a
              guest booking using its reference and registered email.
            </p>
            <div className="trip-actions">
              <Link className="button-link button-link--primary" href="/account/login">
                Customer Sign In
              </Link>
              <Link className="button-link button-link--ghost" href="/account/register">
                Create Account
              </Link>
            </div>
          </div>
        </section>

        <section className="reference-section reference-section--cream">
          <BookingLookup />
        </section>
      </>
    );
  }

  const db = getDb();
  const [cars, packages] = await Promise.all([
    db.carBooking.findMany({
      where: { customerUserId: session.userId },
      orderBy: { startsAt: "desc" },
      select: {
        id: true,
        reference: true,
        status: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        endsAt: true,
        travellers: true,
        currency: true,
        totalMinor: true,
        vehicleClass: { select: { name: true } },
      },
    }),
    db.packageBooking.findMany({
      where: { customerUserId: session.userId },
      orderBy: { travelStartAt: "desc" },
      select: {
        id: true,
        reference: true,
        status: true,
        travelStartAt: true,
        travellers: true,
        currency: true,
        totalMinor: true,
        package: { select: { title: true } },
      },
    }),
  ]);

  const trips = [
    ...cars.map((booking) => ({
      key: `car-${booking.id}`,
      type: "CAR" as const,
      reference: booking.reference,
      status: booking.status,
      title: booking.vehicleClass.name,
      route: `${booking.originText} → ${booking.destinationText}`,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      travellers: booking.travellers,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
    })),
    ...packages.map((booking) => ({
      key: `package-${booking.id}`,
      type: "PACKAGE" as const,
      reference: booking.reference,
      status: booking.status,
      title: booking.package.title,
      route: "Tour package",
      startsAt: booking.travelStartAt,
      endsAt: null,
      travellers: booking.travellers,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
    })),
  ].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());

  return (
    <>
      <section className="story-hero story-hero--my-trips">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <span className="eyebrow">CUSTOMER PORTAL</span>
          <h1>Welcome back{session.name ? `, ${session.name.split(" ")[0]}` : ""}.</h1>
          <p>
            Your account only shows bookings explicitly linked to this verified
            customer identity.
          </p>
          <form action="/api/customer-auth/logout" method="post">
            <button className="button-link button-link--ghost" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          <div className="section-heading">
            <span className="eyebrow">ACCOUNT-LINKED BOOKINGS</span>
            <h2>Your journeys</h2>
            <p>
              Signed in as <strong>{session.email}</strong>. Guest bookings are
              not automatically claimed by email.
            </p>
          </div>

          {trips.length === 0 ? (
            <div className="customer-empty-state">
              <h3>No account-linked trips yet.</h3>
              <p>
                Existing guest bookings remain private and are not automatically
                attached to a new account. You can still look them up securely
                below.
              </p>
            </div>
          ) : (
            <div className="trip-list">
              {trips.map((booking) => (
                <article className="trip-list-card trip-list-card--live" key={booking.key}>
                  <div className="trip-list-card__image">
                    <img
                      src={booking.type === "CAR" ? "/assets/car-innova.webp" : "/assets/temple-hero.webp"}
                      alt=""
                    />
                  </div>
                  <div>
                    <span className="reference-badge">
                      {booking.status.replaceAll("_", " ")}
                    </span>
                    <h2>{booking.title}</h2>
                    <p>{booking.route}</p>
                    <p>
                      {tripDate(booking.startsAt)}
                      {booking.endsAt ? ` – ${tripDate(booking.endsAt)}` : ""}
                      {" · "}
                      {booking.travellers} traveller{booking.travellers === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div>
                    <small>Booking ID</small>
                    <strong>{booking.reference}</strong>
                    <p>
                      Amount <strong>{money(booking.totalMinor, booking.currency)}</strong>
                    </p>
                    <div className="trip-actions">
                      <Link href="/contact">Contact Support</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="customer-guest-lookup">
          <BookingLookup />
        </div>
      </section>
    </>
  );
}
