import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@yatra/db/client";
import { RazorpayPayment } from "@/components/razorpay-payment";

export const metadata: Metadata = {
  title: "Secure Payment",
  robots: { index: false, follow: false },
};

type CheckoutBooking = {
  type: "CAR" | "PACKAGE";
  reference: string;
  status: string;
  title: string;
  route: string;
  startsAt: Date;
  endsAt: Date | null;
  travellers: number;
  currency: string;
  totalMinor: bigint;
};

function money(minor: bigint, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

async function loadCheckoutBooking(reference: string): Promise<CheckoutBooking | null> {
  const db = getDb();

  if (reference.startsWith("YPK-")) {
    const booking = await db.packageBooking.findUnique({
      where: { reference },
      select: {
        reference: true,
        status: true,
        travelStartAt: true,
        travellers: true,
        currency: true,
        totalMinor: true,
        package: { select: { title: true } },
      },
    });

    if (!booking) return null;

    return {
      type: "PACKAGE",
      reference: booking.reference,
      status: booking.status,
      title: booking.package.title,
      route: "Tour package",
      startsAt: booking.travelStartAt,
      endsAt: null,
      travellers: booking.travellers,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
    };
  }

  const booking = await db.carBooking.findUnique({
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

  if (!booking) return null;

  return {
    type: "CAR",
    reference: booking.reference,
    status: booking.status,
    title: booking.vehicleClass.name,
    route: `${booking.originText} → ${booking.destinationText}`,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    travellers: booking.travellers,
    currency: booking.currency,
    totalMinor: booking.totalMinor,
  };
}

export default async function PaymentPage() {
  const jar = await cookies();
  const reference = jar.get("yatra_checkout_booking")?.value;

  if (!reference || !process.env.DATABASE_URL) {
    return (
      <section className="reference-section reference-section--cream">
        <div className="shell payment-state-card">
          <h1>Payment session unavailable</h1>
          <p>Please return to search and create a new booking.</p>
          <Link className="button-link button-link--primary" href="/">Start New Search →</Link>
        </div>
      </section>
    );
  }

  const booking = await loadCheckoutBooking(reference);

  if (!booking) {
    return (
      <section className="reference-section reference-section--cream">
        <div className="shell payment-state-card">
          <h1>Booking not found</h1>
          <p>The booking linked to this payment session no longer exists.</p>
          <Link className="button-link button-link--primary" href="/">Return Home →</Link>
        </div>
      </section>
    );
  }

  const payable = booking.status === "PENDING_PAYMENT" && booking.totalMinor > 0n;

  return (
    <>
      <section className="story-hero story-hero--payment">
        <div className="story-hero__overlay"/>
        <div className="shell story-hero__content">
          <p className="eyebrow">SECURE BOOKING</p>
          <h1>Complete your payment.</h1>
          <p>Your amount is locked to the server-created booking.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell payment-live-grid">
          <article className="booking-card">
            <h2>Booking Summary</h2>
            <dl className="checkout-trip-details">
              <div><dt>Reference</dt><dd>{booking.reference}</dd></div>
              <div><dt>{booking.type === "CAR" ? "Route" : "Package"}</dt><dd>{booking.type === "CAR" ? booking.route : booking.title}</dd></div>
              <div><dt>{booking.type === "CAR" ? "Vehicle" : "Booking Type"}</dt><dd>{booking.type === "CAR" ? booking.title : "Tour package"}</dd></div>
              <div><dt>Travellers</dt><dd>{booking.travellers}</dd></div>
              <div><dt>Departure</dt><dd>{booking.startsAt.toLocaleDateString("en-IN")}</dd></div>
              <div><dt>Return</dt><dd>{booking.endsAt?.toLocaleDateString("en-IN") ?? (booking.type === "CAR" ? "One way" : "As per itinerary")}</dd></div>
              <div><dt>Status</dt><dd>{booking.status.replaceAll("_"," ")}</dd></div>
            </dl>
            <div className="fare-total">
              <span>Amount Due</span>
              <strong>{money(booking.totalMinor, booking.currency)}</strong>
            </div>
          </article>

          <aside className="booking-card payment-column">
            <h2>Secure Payment</h2>
            {payable ? (
              <RazorpayPayment
                bookingType={booking.type}
                bookingReference={booking.reference}
                displayAmount={money(booking.totalMinor, booking.currency)}
              />
            ) : (
              <div className="custom-trip-checkout-notice">
                <strong>Payment is not available for this booking state.</strong>
                <p>
                  Current status: {booking.status.replaceAll("_"," ").toLowerCase()}.
                  Please contact YATRA if you believe payment should be enabled.
                </p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
