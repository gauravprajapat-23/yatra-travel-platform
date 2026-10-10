"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type BookingInput = {
  from: string;
  to: string;
  departure: string;
  returnDate: string;
  travellers: number;
  tripType: "ONE_WAY" | "ROUND_TRIP";
  vehicleSlug: string;
};

type QuoteResponse = {
  quote?: {
    id: string;
    vehicle: {
      slug: string;
      displayName: string;
      seats: number;
      luggage: number | null;
      airConditioned: boolean;
      vehicleClass: string;
    };
    currency: string;
    subtotalMinor: string;
    discountMinor: string;
    taxMinor: string;
    totalMinor: string;
    expiresAt: string;
  };
  error?: { code?: string; message?: string };
};

type PromotionPreviewResponse = {
  promotion?: {
    id: string;
    code: string;
    name: string;
  };
  quote?: {
    id: string;
    currency: string;
    subtotalMinor: string;
    discountMinor: string;
    taxMinor: string;
    totalMinor: string;
  };
  error?: { code?: string; message?: string };
};

type BookingResponse = {
  booking?: {
    reference: string;
    status: string;
    originText: string;
    destinationText: string;
    startsAt: string;
    endsAt: string | null;
    travellers: number;
    currency: string;
    totalMinor: string;
  };
  error?: { code?: string; message?: string };
};

function money(minor: string, currency: string): string {
  const amount = Number(minor) / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `yatra-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CarBookingForm({
  trip,
  promotionsEnabled = false,
}: {
  trip: BookingInput;
  promotionsEnabled?: boolean;
}) {
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [quote, setQuote] = useState<QuoteResponse["quote"]>(undefined);
  const [promotionCode, setPromotionCode] = useState("");
  const [promotionPreview, setPromotionPreview] =
    useState<PromotionPreviewResponse | null>(null);
  const [promotionPending, setPromotionPending] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);


  async function createQuote(): Promise<NonNullable<QuoteResponse["quote"]>> {
    const response = await fetch("/api/quotes/car", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        origin: trip.from,
        destination: trip.to,
        startsAt: trip.departure,
        endsAt: trip.returnDate || undefined,
        travellers: trip.travellers,
        tripType: trip.tripType,
        vehicleSlug: trip.vehicleSlug,
      }),
    });

    const result = (await response.json()) as QuoteResponse;
    if (!response.ok || !result.quote) {
      throw new Error(result.error?.message ?? "Unable to create a server quote.");
    }

    setQuote(result.quote);
    return result.quote;
  }

  async function applyPromotion() {
    setError("");

    if (!promotionsEnabled) return;
    if (!promotionCode.trim()) {
      setPromotionPreview(null);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setError("Enter a valid traveller email before applying a promotion.");
      return;
    }

    setPromotionPending(true);
    try {
      const activeQuote = quote ?? (await createQuote());
      const response = await fetch("/api/promotions/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quoteType: "CAR",
          quoteId: activeQuote.id,
          code: promotionCode.trim(),
          guestEmail: guestEmail.trim().toLowerCase(),
          promotionCode: promotionPreview?.promotion?.code ?? undefined,
        }),
      });
      const result = (await response.json()) as PromotionPreviewResponse;
      if (!response.ok || !result.promotion || !result.quote) {
        throw new Error(
          result.error?.message ?? "Unable to validate promotion.",
        );
      }

      setPromotionCode(result.promotion.code);
      setPromotionPreview(result);
    } catch (caught) {
      setPromotionPreview(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to validate promotion.",
      );
    } finally {
      setPromotionPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!guestName.trim()) {
      setError("Please enter the traveller name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setPending(true);

    try {
      const activeQuote = quote ?? (await createQuote());

      const response = await fetch("/api/bookings/car", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey(),
        },
        body: JSON.stringify({
          quoteId: activeQuote.id,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim().toLowerCase(),
          promotionCode: promotionPreview?.promotion?.code ?? undefined,
        }),
      });

      const result = (await response.json()) as BookingResponse;

      if (!response.ok || !result.booking) {
        if (result.error?.code === "BOOKING_WRITE_DISABLED") {
          throw new Error("Online booking is not enabled in production yet. Please contact YATRA to complete this booking.");
        }
        throw new Error(result.error?.message ?? "Unable to create booking.");
      }

      const params = new URLSearchParams({
        source: "car-booking",
        bookingReference: result.booking.reference,
      });
      if (guestPhone.trim()) params.set("phone", guestPhone.trim());

      router.push(`/checkout?${params.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="booking-layout" onSubmit={submit}>
      <div className="booking-main">
        <section className="booking-card">
          <h2>Your Selected Vehicle</h2>
          <div className="selected-vehicle">
            <div className="selected-vehicle__visual">
              <img src="/assets/car-innova.webp" alt="Selected chauffeur-driven vehicle" />
            </div>
            <div>
              <h3>{quote?.vehicle.displayName ?? trip.vehicleSlug.replaceAll("-", " ")}</h3>
              <p>{quote ? `${quote.vehicle.vehicleClass} · ${quote.vehicle.seats} Seats` : "Fare will be verified by the server."}</p>
              <div className="reference-hero-badges">
                <span>Server-verified price</span>
                <span>Driver included</span>
                <span>Vehicle subject to availability</span>
              </div>
            </div>
          </div>
        </section>

        <section className="booking-card">
          <h2>Traveller Details</h2>
          <div className="form-grid">
            <label>
              Full Name
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="name" required />
            </label>
            <label>
              Email
              <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label>
              Mobile Number
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} autoComplete="tel" placeholder="+91" />
            </label>
          </div>
        </section>

        {error ? <p className="booking-flow-error" role="alert">{error}</p> : null}
      </div>

      <aside className="booking-sidebar">
        {promotionsEnabled ? (
          <div className="booking-card">
            <h2>Promotion Code</h2>
            <label>
              Code
              <input
                value={promotionCode}
                onChange={(event) => {
                  setPromotionCode(event.target.value.toUpperCase());
                  setPromotionPreview(null);
                }}
                maxLength={32}
                placeholder="YATRA10"
              />
            </label>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={promotionPending || !promotionCode.trim()}
              onClick={applyPromotion}
            >
              {promotionPending ? "Checking…" : "Apply Promotion"}
            </button>
            {promotionPreview?.promotion ? (
              <p className="lead-form-success" role="status">
                {promotionPreview.promotion.code} applied · {promotionPreview.promotion.name}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="booking-card">
          <h2>Trip Details</h2>
          <div className="trip-pair">
            <strong>{trip.from}</strong>
            <span>→</span>
            <strong>{trip.to}</strong>
          </div>
          <dl>
            <div><dt>Departure</dt><dd>{trip.departure || "Not selected"}</dd></div>
            <div><dt>Return</dt><dd>{trip.returnDate || "One way"}</dd></div>
            <div><dt>Travellers</dt><dd>{trip.travellers}</dd></div>
            <div><dt>Trip Type</dt><dd>{trip.tripType === "ROUND_TRIP" ? "Round Trip" : "One Way"}</dd></div>
          </dl>
        </div>

        <div className="booking-card fare-card">
          <h2>Server Quote</h2>
          {quote ? (
            <>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>
                    {money(
                      promotionPreview?.quote?.subtotalMinor ?? quote.subtotalMinor,
                      promotionPreview?.quote?.currency ?? quote.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>
                    {money(
                      promotionPreview?.quote?.discountMinor ?? quote.discountMinor,
                      promotionPreview?.quote?.currency ?? quote.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Tax</dt>
                  <dd>
                    {money(
                      promotionPreview?.quote?.taxMinor ?? quote.taxMinor,
                      promotionPreview?.quote?.currency ?? quote.currency,
                    )}
                  </dd>
                </div>
              </dl>
              <div className="fare-total">
                <span>Total Amount</span>
                <strong>
                  {money(
                    promotionPreview?.quote?.totalMinor ?? quote.totalMinor,
                    promotionPreview?.quote?.currency ?? quote.currency,
                  )}
                </strong>
              </div>
              <small>Quote expires at {new Date(quote.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
            </>
          ) : (
            <p>Price is calculated only after the server validates the vehicle and active pricing rule.</p>
          )}

          <button className="button-link button-link--primary" type="submit" disabled={pending}>
            {pending ? "Creating Booking…" : quote ? "Create Booking →" : "Get Quote & Continue →"}
          </button>
        </div>
      </aside>
    </form>
  );
}
