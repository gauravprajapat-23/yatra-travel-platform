"use client";

import { useMemo, useState } from "react";

type PriceOption = {
  id: string;
  amountMinor: string;
  currency: string;
  mode: "PER_PERSON" | "PER_VEHICLE" | "PER_GROUP" | "FIXED";
  minTravellers: number | null;
  maxTravellers: number | null;
  vehicleClass: string | null;
};

type Departure = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  capacityTravellers: number | null;
  reservedTravellers: number;
  remainingCapacity: number | null;
  salesCloseAt: string | null;
};

type QuoteResult = {
  quote?: {
    id: string;
    currency: string;
    subtotalMinor: string;
    discountMinor: string;
    taxMinor: string;
    totalMinor: string;
    expiresAt: string;
    departure: {
      id: string;
      startsAt: string;
      endsAt: string | null;
      remainingCapacity: number | null;
    };
    priceOption: {
      id: string;
      mode: PriceOption["mode"];
    };
  };
  error?: { code?: string; message?: string };
};

type BookingResult = {
  replayed?: boolean;
  booking?: {
    reference: string;
    status: string;
  };
  error?: { code?: string; message?: string };
};

function money(minor: string, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export function PackageDepartureQuoteForm({
  packageSlug,
  priceOptions,
  departures,
  bookingEnabled,
}: {
  packageSlug: string;
  priceOptions: PriceOption[];
  departures: Departure[];
  bookingEnabled: boolean;
}) {
  const [priceOptionId, setPriceOptionId] = useState(priceOptions[0]?.id ?? "");
  const [departureId, setDepartureId] = useState(departures[0]?.id ?? "");
  const [travellers, setTravellers] = useState(
    Math.max(1, priceOptions[0]?.minTravellers ?? 2),
  );
  const [vehicleCount, setVehicleCount] = useState(1);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [quote, setQuote] = useState<QuoteResult["quote"]>();
  const [pending, setPending] = useState(false);
  const [bookingPending, setBookingPending] = useState(false);
  const [error, setError] = useState("");

  const selectedOption = useMemo(
    () => priceOptions.find((item) => item.id === priceOptionId) ?? null,
    [priceOptionId, priceOptions],
  );

  const selectedDeparture = useMemo(
    () => departures.find((item) => item.id === departureId) ?? null,
    [departureId, departures],
  );

  function clearQuote() {
    setQuote(undefined);
    setError("");
  }

  async function createQuote() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/quotes/package", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          packageSlug,
          priceOptionId,
          departureId,
          travellers,
          vehicleCount:
            selectedOption?.mode === "PER_VEHICLE" ? vehicleCount : null,
        }),
      });

      const result = (await response.json()) as QuoteResult;
      if (!response.ok || !result.quote) {
        throw new Error(
          result.error?.message ?? "Unable to create package quote.",
        );
      }

      setQuote(result.quote);
      return result.quote;
    } catch (caught) {
      setQuote(undefined);
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create package quote.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }

  async function createBooking() {
    if (!bookingEnabled || !quote) return;

    setBookingPending(true);
    setError("");

    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `package-${crypto.randomUUID()}`
          : `package-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch("/api/bookings/package", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          quoteId: quote.id,
          guestName: guestName.trim() || undefined,
          guestEmail: guestEmail.trim().toLowerCase() || undefined,
        }),
      });

      const result = (await response.json()) as BookingResult;
      if (!response.ok || !result.booking) {
        throw new Error(
          result.error?.message ?? "Unable to create package booking.",
        );
      }

      window.location.assign("/booking/success");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create package booking.",
      );
    } finally {
      setBookingPending(false);
    }
  }

  if (priceOptions.length === 0 || departures.length === 0) {
    return (
      <div className="package-departure-quote">
        <h3>Departure booking</h3>
        <p>
          No online departure is currently available. Request a custom journey
          and the YATRA team will confirm dates and pricing.
        </p>
      </div>
    );
  }

  return (
    <div className="package-departure-quote">
      <h3>Choose Departure</h3>

      <label>
        Departure
        <select
          value={departureId}
          onChange={(event) => {
            setDepartureId(event.target.value);
            clearQuote();
          }}
        >
          {departures.map((departure) => (
            <option key={departure.id} value={departure.id}>
              {new Date(departure.startsAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              {departure.remainingCapacity === null
                ? " · Open capacity"
                : ` · ${departure.remainingCapacity} seats left`}
            </option>
          ))}
        </select>
      </label>

      <label>
        Price option
        <select
          value={priceOptionId}
          onChange={(event) => {
            const next = priceOptions.find(
              (item) => item.id === event.target.value,
            );
            setPriceOptionId(event.target.value);
            if (next?.minTravellers && travellers < next.minTravellers) {
              setTravellers(next.minTravellers);
            }
            clearQuote();
          }}
        >
          {priceOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {money(option.amountMinor, option.currency)} ·{" "}
              {option.mode.replaceAll("_", " ").toLowerCase()}
              {option.vehicleClass ? ` · ${option.vehicleClass}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label>
        Travellers
        <input
          type="number"
          min={selectedOption?.minTravellers ?? 1}
          max={
            Math.min(
              selectedOption?.maxTravellers ?? 100,
              selectedDeparture?.remainingCapacity ?? 100,
            )
          }
          value={travellers}
          onChange={(event) => {
            setTravellers(Number(event.target.value));
            clearQuote();
          }}
        />
      </label>

      {selectedOption?.mode === "PER_VEHICLE" ? (
        <label>
          Vehicles
          <input
            type="number"
            min={1}
            max={50}
            value={vehicleCount}
            onChange={(event) => {
              setVehicleCount(Number(event.target.value));
              clearQuote();
            }}
          />
        </label>
      ) : null}

      <button
        className="button-link button-link--secondary"
        type="button"
        disabled={pending || !departureId || !priceOptionId}
        onClick={createQuote}
      >
        {pending ? "Calculating…" : "Get Live Quote"}
      </button>

      {quote ? (
        <div className="package-live-quote" role="status">
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{money(quote.subtotalMinor, quote.currency)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{money(quote.totalMinor, quote.currency)}</dd>
            </div>
          </dl>
          <small>
            Quote expires{" "}
            {new Date(quote.expiresAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Capacity is rechecked when booking.
          </small>

          {bookingEnabled ? (
            <>
              <label>
                Traveller name
                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Required for guest checkout"
                />
              </label>
              <label>
                Traveller email
                <input
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  maxLength={254}
                  type="email"
                  autoComplete="email"
                  placeholder="Required for guest checkout"
                />
              </label>
              <button
                className="button-link button-link--primary"
                type="button"
                disabled={bookingPending}
                onClick={createBooking}
              >
                {bookingPending ? "Creating Booking…" : "Book This Departure"}
              </button>
            </>
          ) : (
            <p>
              Online booking creation is not enabled yet. Use the custom-trip
              request below to reserve with the YATRA team.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="lead-form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
