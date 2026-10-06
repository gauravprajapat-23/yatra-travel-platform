import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDb } from "@yatra/db/client";
import {
  CHECKOUT_SESSION_COOKIE,
  verifyCheckoutSessionToken,
} from "@/lib/checkout-session";

export const metadata: Metadata = {
  title: "Booking Checkout",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function clean(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function money(minor: bigint, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const source = first(params.source);
  const isCustomTrip = source === "custom-trip";

  const customTrip = isCustomTrip
    ? {
        title: "Custom Journey",
        from: clean(first(params.from, "Delhi"), 120),
        to: clean(first(params.to, "Kedarnath"), 120),
        duration: clean(first(params.duration, "6"), 2),
        travelDate: clean(first(params.travelDate), 20),
        travellers: clean(first(params.travellers, "4"), 2),
        vehicle: clean(first(params.vehicle, "SUV · 6 Seats"), 80),
        requests: clean(first(params.requests), 1000),
      }
    : null;

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

  if (!isCustomTrip && process.env.DATABASE_URL) {
    const jar = await cookies();
    const checkoutSession = verifyCheckoutSessionToken(
      jar.get(CHECKOUT_SESSION_COOKIE)?.value,
    );

    if (checkoutSession?.t === "CAR") {
      const db = getDb();
      booking = await db.carBooking.findUnique({
        where: { reference: checkoutSession.r },
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
  }

  if (!isCustomTrip && !booking) {
    return (
      <section className="reference-section reference-section--cream">
        <div className="shell checkout-invalid-state booking-card">
          <h1>Checkout session unavailable</h1>
          <p>Your booking session may have expired. Please search for a vehicle and create a new booking.</p>
          <Link className="button-link button-link--primary" href="/">Start New Search →</Link>
        </div>
      </section>
    );
  }

  const canPay =
    Boolean(booking) &&
    booking?.status === "PENDING_PAYMENT" &&
    booking.totalMinor > 0n;

  return (
    <section className="reference-section reference-section--cream">
      <div className="shell stepper">
        {["Trip Summary", "Booking", "Payment", "Confirmation"].map((x, i) => (
          <span
            className={i <= 1 ? "stepper__step stepper__step--active" : "stepper__step"}
            key={x}
          >
            {i + 1}
            <small>{x}</small>
          </span>
        ))}
      </div>

      <div className="shell checkout-grid">
        <aside className="booking-card checkout-summary">
          <h2>Trip Summary</h2>
          <div className="checkout-trip-image" />

          {customTrip ? (
            <>
              <h3>{customTrip.title}</h3>
              <p>{customTrip.duration} Days · {customTrip.vehicle}</p>
              <dl className="checkout-trip-details">
                <div><dt>From</dt><dd>{customTrip.from}</dd></div>
                <div><dt>To</dt><dd>{customTrip.to}</dd></div>
                <div><dt>Travel date</dt><dd>{customTrip.travelDate || "To be confirmed"}</dd></div>
                <div><dt>Travellers</dt><dd>{customTrip.travellers}</dd></div>
              </dl>
              {customTrip.requests ? (
                <div className="checkout-special-request">
                  <strong>Special requests</strong>
                  <p>{customTrip.requests}</p>
                </div>
              ) : null}
              <div className="fare-total">
                <span>Final Price</span>
                <strong>Quote pending</strong>
              </div>
            </>
          ) : booking ? (
            <>
              <h3>{booking.originText} → {booking.destinationText}</h3>
              <p>{booking.vehicleClass.name} · {booking.travellers} Travellers</p>
              <dl className="checkout-trip-details">
                <div><dt>Booking</dt><dd>{booking.reference}</dd></div>
                <div><dt>Departure</dt><dd>{booking.startsAt.toLocaleDateString("en-IN")}</dd></div>
                <div><dt>Return</dt><dd>{booking.endsAt?.toLocaleDateString("en-IN") ?? "One way"}</dd></div>
                <div><dt>Status</dt><dd>{booking.status.replaceAll("_", " ")}</dd></div>
              </dl>
              <div className="fare-total">
                <span>Total Amount</span>
                <strong>{money(booking.totalMinor, booking.currency)}</strong>
              </div>
            </>
          ) : null}
        </aside>

        <section className="booking-card checkout-assurance">
          <h2>Booking Protection</h2>
          <ul>
            <li>Price shown above comes from the server-created quote.</li>
            <li>Booking status is controlled by the server lifecycle.</li>
            <li>Payment amount cannot be changed by the browser.</li>
            <li>Razorpay verification and webhooks confirm successful payment.</li>
          </ul>
        </section>

        <aside className="booking-card payment-column">
          <h2>Payment</h2>

          {customTrip ? (
            <div className="custom-trip-checkout-notice">
              <strong>Price confirmation required</strong>
              <p>Your request needs review before payment can be enabled.</p>
            </div>
          ) : canPay && booking ? (
            <Link className="button-link button-link--primary" href="/payment">
              Continue to Secure Payment →
            </Link>
          ) : (
            <div className="custom-trip-checkout-notice">
              <strong>Payment not required yet</strong>
              <p>
                This booking is currently {booking?.status.replaceAll("_", " ").toLowerCase()}.
                The YATRA team will enable payment when the booking reaches the payable stage.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
