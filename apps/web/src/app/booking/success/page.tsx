import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@yatra/db/client";

export const metadata: Metadata = {
  title: "Booking Confirmed",
  robots: { index: false, follow: false },
};

function money(minor: bigint, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export default async function BookingSuccessPage() {
  const jar = await cookies();
  const reference = jar.get("yatra_checkout_booking")?.value;

  let booking:
    | {
        reference: string;
        status: string;
        originText: string;
        destinationText: string;
        startsAt: Date;
        endsAt: Date | null;
        travellers: number;
        currency: string;
        totalMinor: bigint;
        vehicleClass: { name: string };
      }
    | null = null;

  if (reference && process.env.DATABASE_URL) {
    const db = getDb();
    booking = await db.carBooking.findUnique({
      where: { reference },
      select: {
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
    });
  }

  if (!booking) {
    return (
      <section className="reference-section reference-section--cream">
        <div className="shell payment-state-card">
          <h1>Booking details unavailable</h1>
          <p>Please use your booking reference to contact YATRA support.</p>
          <Link className="button-link button-link--primary" href="/contact">Contact Support →</Link>
        </div>
      </section>
    );
  }

  const confirmed = booking.status === "CONFIRMED";

  return (
    <>
      <section className={confirmed ? "success-hero" : "success-hero success-hero--pending"}>
        <div className="shell">
          <span className="success-icon">{confirmed ? "✓" : "◷"}</span>
          <h1>{confirmed ? "Booking Confirmed!" : "Booking Received"}</h1>
          <p>
            {confirmed
              ? "Your payment has been verified and your journey is confirmed."
              : "Your booking exists, but confirmation is still pending."}
          </p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell success-banner">
          <span className="success-icon success-icon--small">{confirmed ? "✓" : "◷"}</span>
          <div>
            <h2>{confirmed ? "Thank you for choosing YATRA!" : "We are processing your booking."}</h2>
            <p>Keep your booking reference for support and future lookup.</p>
          </div>
          <div>
            <small>BOOKING ID</small>
            <strong>{booking.reference}</strong>
          </div>
        </div>

        <div className="shell success-grid">
          <article className="booking-card">
            <h2>Trip Summary</h2>
            <div className="selected-vehicle">
              <div className="selected-vehicle__visual">
                <img src="/assets/car-innova.webp" alt="Booked chauffeur-driven vehicle"/>
              </div>
              <div>
                <h3>{booking.vehicleClass.name}</h3>
                <p>{booking.originText} → {booking.destinationText}</p>
                <dl>
                  <div><dt>Departure</dt><dd>{booking.startsAt.toLocaleDateString("en-IN")}</dd></div>
                  <div><dt>Return</dt><dd>{booking.endsAt?.toLocaleDateString("en-IN") ?? "One way"}</dd></div>
                  <div><dt>Travellers</dt><dd>{booking.travellers}</dd></div>
                  <div><dt>Status</dt><dd>{booking.status.replaceAll("_"," ")}</dd></div>
                </dl>
                <strong>{money(booking.totalMinor, booking.currency)} · {confirmed ? "Payment verified" : "Payment/confirmation pending"}</strong>
              </div>
            </div>
          </article>

          <aside className="booking-card">
            <h2>Need Help?</h2>
            <p>Our travel experts can assist with this booking using reference <strong>{booking.reference}</strong>.</p>
            <Link className="button-link button-link--primary" href="/contact">Contact Support →</Link>
          </aside>
        </div>
      </section>
    </>
  );
}
