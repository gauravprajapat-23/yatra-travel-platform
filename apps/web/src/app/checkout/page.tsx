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

export default async function CheckoutPage() {
  let booking: CheckoutBooking | null = null;

  if (process.env.DATABASE_URL) {
    const jar = await cookies();
    const checkoutSession = verifyCheckoutSessionToken(
      jar.get(CHECKOUT_SESSION_COOKIE)?.value,
    );

    if (checkoutSession) {
      const db = getDb();

      if (checkoutSession.t === "PACKAGE") {
        const record = await db.packageBooking.findUnique({
          where: { reference: checkoutSession.r },
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

        if (record) {
          booking = {
            type: "PACKAGE",
            reference: record.reference,
            status: record.status,
            title: record.package.title,
            route: "Tour package",
            startsAt: record.travelStartAt,
            endsAt: null,
            travellers: record.travellers,
            currency: record.currency,
            totalMinor: record.totalMinor,
          };
        }
      } else {
        const record = await db.carBooking.findUnique({
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

        if (record) {
          booking = {
            type: "CAR",
            reference: record.reference,
            status: record.status,
            title: record.vehicleClass.name,
            route: `${record.originText} → ${record.destinationText}`,
            startsAt: record.startsAt,
            endsAt: record.endsAt,
            travellers: record.travellers,
            currency: record.currency,
            totalMinor: record.totalMinor,
          };
        }
      }
    }
  }

  if (!booking) {
    return (
      <section className="reference-section reference-section--cream">
        <div className="shell checkout-invalid-state booking-card">
          <h1>Checkout session unavailable</h1>
          <p>Your booking session may have expired. Please return to search or your package and create a new booking.</p>
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

          {booking ? (
            <>
              <h3>{booking.route}</h3>
              <p>{booking.title} · {booking.travellers} Travellers</p>
              <dl className="checkout-trip-details">
                <div><dt>Booking</dt><dd>{booking.reference}</dd></div>
                <div><dt>Departure</dt><dd>{booking.startsAt.toLocaleDateString("en-IN")}</dd></div>
                <div><dt>Return</dt><dd>{booking.endsAt?.toLocaleDateString("en-IN") ?? (booking.type === "CAR" ? "One way" : "As per itinerary")}</dd></div>
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

          {canPay && booking ? (
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
