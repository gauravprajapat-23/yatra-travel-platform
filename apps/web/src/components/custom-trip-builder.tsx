"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TripFormState = {
  from: string;
  to: string;
  duration: string;
  travelDate: string;
  travellers: string;
  vehicle: string;
  requests: string;
};

const initialState: TripFormState = {
  from: "Delhi",
  to: "Kedarnath",
  duration: "6",
  travelDate: "",
  travellers: "4",
  vehicle: "SUV · 6 Seats",
  requests: "",
};

export function CustomTripBuilder() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<TripFormState>(initialState);
  const [error, setError] = useState("");

  const durationLabel = useMemo(
    () => `${form.duration || "0"} Days`,
    [form.duration],
  );

  function update<K extends keyof TripFormState>(key: K, value: TripFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const from = form.from.trim();
    const to = form.to.trim();
    const travellers = Number(form.travellers);
    const duration = Number(form.duration);

    if (!from || !to) {
      setError("Please enter both the starting city and destination.");
      return;
    }

    if (!form.travelDate) {
      setError("Please select your travel date.");
      return;
    }

    if (!Number.isInteger(travellers) || travellers < 1 || travellers > 30) {
      setError("Travellers must be between 1 and 30.");
      return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 30) {
      setError("Trip duration must be between 1 and 30 days.");
      return;
    }

    const params = new URLSearchParams({
      source: "custom-trip",
      from,
      to,
      duration: String(duration),
      travelDate: form.travelDate,
      travellers: String(travellers),
      vehicle: form.vehicle,
    });

    if (form.requests.trim()) {
      params.set("requests", form.requests.trim());
    }

    startTransition(() => {
      router.push(`/checkout?${params.toString()}`);
    });
  }

  return (
    <div className="shell trip-builder">
      <form className="trip-builder__form" onSubmit={handleSubmit} noValidate>
        <h2>Trip Details</h2>

        <div className="trip-builder__grid">
          <label>
            From
            <input
              name="from"
              value={form.from}
              onChange={(event) => update("from", event.target.value)}
              autoComplete="address-level2"
              required
            />
          </label>

          <label>
            To
            <input
              name="to"
              value={form.to}
              onChange={(event) => update("to", event.target.value)}
              autoComplete="off"
              required
            />
          </label>

          <label>
            Duration
            <select
              name="duration"
              value={form.duration}
              onChange={(event) => update("duration", event.target.value)}
            >
              {[3, 4, 5, 6, 7, 8, 10, 12].map((days) => (
                <option value={days} key={days}>{days} Days</option>
              ))}
            </select>
          </label>

          <label>
            Travel Date
            <input
              name="travelDate"
              type="date"
              value={form.travelDate}
              onChange={(event) => update("travelDate", event.target.value)}
              required
            />
          </label>

          <label>
            No. of Travellers
            <input
              name="travellers"
              type="number"
              min="1"
              max="30"
              value={form.travellers}
              onChange={(event) => update("travellers", event.target.value)}
              required
            />
          </label>

          <label>
            Preferred Vehicle
            <select
              name="vehicle"
              value={form.vehicle}
              onChange={(event) => update("vehicle", event.target.value)}
            >
              <option>SUV · 6 Seats</option>
              <option>Innova Crysta · 6 Seats</option>
              <option>Tempo Traveller · 12–17 Seats</option>
              <option>Luxury Vehicle</option>
            </select>
          </label>
        </div>

        <label>
          Special Requests
          <textarea
            name="requests"
            value={form.requests}
            onChange={(event) => update("requests", event.target.value)}
            placeholder="Senior citizens, extra luggage, temple darshan, specific hotels..."
            maxLength={1000}
          />
        </label>

        {error ? (
          <p className="trip-builder__error" role="alert">{error}</p>
        ) : null}

        <button
          className="button-link button-link--primary"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Creating Trip…" : "Create My Trip →"}
        </button>
      </form>

      <aside className="trip-builder__summary">
        <p className="eyebrow">LIVE PACKAGE SUMMARY</p>
        <h2>Custom Journey</h2>
        <strong className="trip-builder__price">Quote after review</strong>
        <p>{durationLabel} · {form.travellers || "0"} Travellers</p>

        <div className="trip-builder__route">
          <span>Start · {form.from || "Starting city"}</span>
          <span>Destination · {form.to || "Destination"}</span>
          <span>Vehicle · {form.vehicle}</span>
          <span>Date · {form.travelDate || "Select travel date"}</span>
        </div>

        <small>
          Your request is carried securely to checkout. Final itinerary and
          price remain server-authoritative.
        </small>
      </aside>
    </div>
  );
}
