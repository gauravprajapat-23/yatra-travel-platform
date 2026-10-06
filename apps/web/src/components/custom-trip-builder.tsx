"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TripFormState = {
  name: string;
  email: string;
  phone: string;
  from: string;
  to: string;
  duration: string;
  travelDate: string;
  travellers: string;
  vehicle: string;
  requests: string;
  website: string;
};

const initialState: TripFormState = {
  name: "",
  email: "",
  phone: "",
  from: "Delhi",
  to: "Kedarnath",
  duration: "6",
  travelDate: "",
  travellers: "4",
  vehicle: "SUV · 6 Seats",
  requests: "",
  website: "",
};

function key(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    const from = form.from.trim();
    const to = form.to.trim();
    const travellers = Number(form.travellers);
    const duration = Number(form.duration);

    if (!name) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

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

    setError("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": key(),
        },
        body: JSON.stringify({
          type: "CUSTOM_TRIP",
          name,
          email,
          phone,
          message: form.requests.trim() || undefined,
          sourcePath: "/custom-trip",
          website: form.website,
          trip: {
            from,
            to,
            duration,
            travelDate: form.travelDate,
            travellers,
            vehicle: form.vehicle,
          },
        }),
      });

      const result = (await response.json()) as {
        reference?: string;
        error?: { message?: string };
      };

      if (!response.ok || !result.reference) {
        throw new Error(
          result.error?.message ?? "Unable to save your custom trip request.",
        );
      }

      const params = new URLSearchParams({
        source: "custom-trip",
        leadReference: result.reference,
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
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create your trip request.",
      );
    }
  }

  return (
    <div className="shell trip-builder">
      <form className="trip-builder__form" onSubmit={handleSubmit} noValidate>
        <h2>Trip Details</h2>

        <div className="trip-builder__grid">
          <label>
            Full Name
            <input
              name="name"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              autoComplete="name"
              required
            />
          </label>

          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Mobile Number
            <input
              name="phone"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              autoComplete="tel"
              placeholder="+91"
            />
          </label>

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

        <label className="lead-honeypot" aria-hidden="true">
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(event) => update("website", event.target.value)}
          />
        </label>

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
          Your request is saved before checkout. Final itinerary and price
          remain server-authoritative.
        </small>
      </aside>
    </div>
  );
}
