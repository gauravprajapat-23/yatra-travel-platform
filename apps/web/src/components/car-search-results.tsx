"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicFleetVehicle } from "@/lib/public-fleet";

type SearchInput = {
  from: string;
  to: string;
  departure: string;
  returnDate: string;
  travellers: number;
  tripType: "ONE_WAY" | "ROUND_TRIP";
};

export function CarSearchResults({
  search,
  vehicles,
}: {
  search: SearchInput;
  vehicles: PublicFleetVehicle[];
}) {
  const [vehicleClass, setVehicleClass] = useState("ALL");
  const [capacity, setCapacity] = useState("ALL");
  const [acOnly, setAcOnly] = useState(false);
  const [sort, setSort] = useState("recommended");

  const classes = useMemo(
    () => ["ALL", ...Array.from(new Set(vehicles.map((vehicle) => vehicle.className)))],
    [vehicles],
  );

  const filtered = useMemo(() => {
    const rows = vehicles.filter((vehicle) => {
      if (vehicleClass !== "ALL" && vehicle.className !== vehicleClass) return false;
      if (capacity === "UP_TO_6" && vehicle.seats > 6) return false;
      if (capacity === "7_12" && (vehicle.seats < 7 || vehicle.seats > 12)) return false;
      if (capacity === "13_PLUS" && vehicle.seats < 13) return false;
      if (acOnly && !vehicle.airConditioned) return false;
      if (vehicle.seats < search.travellers) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sort === "capacity") return b.seats - a.seats;
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      return Number(b.isFeatured) - Number(a.isFeatured) || a.displayName.localeCompare(b.displayName);
    });
  }, [vehicles, vehicleClass, capacity, acOnly, sort, search.travellers]);

  const query = new URLSearchParams({
    from: search.from,
    to: search.to,
    departure: search.departure,
    travellers: String(search.travellers),
    tripType: search.tripType,
  });
  if (search.returnDate) query.set("return", search.returnDate);

  return (
    <>
      <div className="shell route-summary-bar route-summary-bar--reference">
        <span><small>FROM</small><b>{search.from}</b><em>Starting city</em></span>
        <b className="route-arrow">→</b>
        <span><small>TO</small><b>{search.to}</b><em>Destination</em></span>
        <span><small>DEPARTURE</small><b>{search.departure || "Not set"}</b><em>Departure</em></span>
        <span><small>RETURN</small><b>{search.returnDate || "One way"}</b><em>{search.tripType === "ROUND_TRIP" ? "Return" : "One way"}</em></span>
        <span><small>TRAVELLERS</small><b>{search.travellers}</b><em>Travellers</em></span>
        <Link className="button-link button-link--primary" href="/">Edit Search</Link>
      </div>

      <div className="shell search-results-layout search-results-layout--reference">
        <aside className="search-filter-panel">
          <div className="filter-title-row">
            <h2>Filters</h2>
            <button
              type="button"
              onClick={() => {
                setVehicleClass("ALL");
                setCapacity("ALL");
                setAcOnly(false);
              }}
            >
              Clear All
            </button>
          </div>

          <strong>Vehicle Class</strong>
          {classes.map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="vehicleClass"
                checked={vehicleClass === value}
                onChange={() => setVehicleClass(value)}
              />
              {value === "ALL" ? "All Vehicles" : value}
            </label>
          ))}

          <hr/>
          <strong>Seating Capacity</strong>
          {[
            ["ALL","Any capacity"],
            ["UP_TO_6","Up to 6"],
            ["7_12","7–12"],
            ["13_PLUS","13+"],
          ].map(([value,label]) => (
            <label key={value}>
              <input
                type="radio"
                name="capacity"
                checked={capacity === value}
                onChange={() => setCapacity(value)}
              />
              {label}
            </label>
          ))}

          <hr/>
          <strong>Features</strong>
          <label>
            <input
              type="checkbox"
              checked={acOnly}
              onChange={(e) => setAcOnly(e.target.checked)}
            />
            AC only
          </label>
        </aside>

        <div className="search-results">
          <div className="results-heading">
            <h1>{filtered.length} Cars Available</h1>
            <label>
              Sort by:
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="capacity">Seating Capacity</option>
                <option value="name">Vehicle Name</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="search-empty-state">
              <h2>No active vehicles match this search.</h2>
              <p>Try fewer travellers, clear filters, or submit a custom trip request.</p>
              <Link className="button-link button-link--primary" href="/custom-trip">Request a Custom Trip →</Link>
            </div>
          ) : (
            filtered.map((vehicle) => (
              <article className="search-result-card search-result-card--reference" key={vehicle.id}>
                <div className="search-result-card__image">
                  <img src={vehicle.primaryImageUrl ?? "/assets/car-innova.webp"} alt={vehicle.displayName} loading="lazy"/>
                  {vehicle.isFeatured ? <span className="vehicle-card-badge">Featured</span> : null}
                </div>

                <div className="search-result-card__body">
                  <h2>{vehicle.displayName}</h2>
                  <p>{vehicle.className}</p>
                  <div className="result-specs">
                    <span>♙ {vehicle.seats} Seats</span>
                    <span>▣ {vehicle.luggage ?? "—"} Bags</span>
                    <span>❄ {vehicle.airConditioned ? "AC" : "Non-AC"}</span>
                  </div>
                  <ul>
                    <li>Only active fleet records are shown</li>
                    <li>Final fare is calculated by the server</li>
                    <li>Selected vehicle remains subject to availability</li>
                  </ul>
                </div>

                <div className="search-result-card__price">
                  <strong>Server quote</strong>
                  <small>No browser-authoritative fare</small>
                  <Link
                    className="button-link button-link--primary"
                    href={`/booking/car?vehicle=${encodeURIComponent(vehicle.slug)}&${query.toString()}`}
                  >
                    Choose Vehicle →
                  </Link>
                  <Link href={`/cars/${vehicle.slug}`}>View Details</Link>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </>
  );
}
