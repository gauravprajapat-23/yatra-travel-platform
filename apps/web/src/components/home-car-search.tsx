"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function HomeCarSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedVehicle = searchParams.get("vehicle")?.trim().slice(0, 120) || "";
  const today = useMemo(() => new Date(), []);
  const defaultDeparture = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return toInputDate(d);
  }, [today]);
  const defaultReturn = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 10);
    return toInputDate(d);
  }, [today]);

  const [from, setFrom] = useState("Raipur");
  const [to, setTo] = useState("Ujjain");
  const [departure, setDeparture] = useState(defaultDeparture);
  const [returnDate, setReturnDate] = useState(defaultReturn);
  const [travellers, setTravellers] = useState("4");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const count = Number(travellers);
    if (!from.trim() || !to.trim()) {
      setError("Please enter both From and To.");
      return;
    }
    if (!departure) {
      setError("Please select a departure date.");
      return;
    }
    if (returnDate && returnDate < departure) {
      setError("Return date cannot be before departure.");
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > 30) {
      setError("Travellers must be between 1 and 30.");
      return;
    }

    const params = new URLSearchParams({
      from: from.trim(),
      to: to.trim(),
      departure,
      travellers: String(count),
      tripType: returnDate ? "ROUND_TRIP" : "ONE_WAY",
    });
    if (returnDate) params.set("return", returnDate);

    if (selectedVehicle) params.set("vehicle", selectedVehicle);

    router.push(
      selectedVehicle
        ? `/booking/car?${params.toString()}`
        : `/cars/search?${params.toString()}`,
    );
  }

  return (
    <form id="car-search" className="shell reference-search-card reference-search-card--interactive" onSubmit={submit}>
      <label className="reference-search-card__field">
        <span>From</span>
        <input value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From city" />
      </label>
      <label className="reference-search-card__field">
        <span>To</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} aria-label="Destination city" />
      </label>
      <label className="reference-search-card__field">
        <span>Departure</span>
        <input type="date" min={toInputDate(today)} value={departure} onChange={(e) => setDeparture(e.target.value)} aria-label="Departure date" />
      </label>
      <label className="reference-search-card__field">
        <span>Return</span>
        <input type="date" min={departure || toInputDate(today)} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} aria-label="Return date" />
      </label>
      <label className="reference-search-card__field">
        <span>Travellers</span>
        <input type="number" min="1" max="30" value={travellers} onChange={(e) => setTravellers(e.target.value)} aria-label="Travellers" />
      </label>
      <button className="button-link button-link--primary" type="submit">{selectedVehicle ? "Continue With This Car →" : "Find Cars →"}</button>
      {error ? <p className="reference-search-card__error" role="alert">{error}</p> : null}
    </form>
  );
}
