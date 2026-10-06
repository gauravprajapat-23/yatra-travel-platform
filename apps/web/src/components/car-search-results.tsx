"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SearchInput = {
  from: string;
  to: string;
  departure: string;
  returnDate: string;
  travellers: number;
  tripType: "ONE_WAY" | "ROUND_TRIP";
};

type VehicleRow = {
  name: string;
  slug: string;
  type: "SUV" | "SEDAN" | "TEMPO" | "LUXURY";
  seats: number;
  bags: number;
  ac: boolean;
  gps: boolean;
  rate: number;
  featured?: boolean;
};

const vehicles: VehicleRow[] = [
  { name: "Innova Crysta", slug: "innova-crysta", type: "SUV", seats: 6, bags: 4, ac: true, gps: true, rate: 14, featured: true },
  { name: "Ertiga", slug: "ertiga", type: "SUV", seats: 6, bags: 4, ac: true, gps: true, rate: 12 },
  { name: "Toyota Fortuner", slug: "fortuner", type: "LUXURY", seats: 6, bags: 4, ac: true, gps: true, rate: 20 },
  { name: "Tempo Traveller", slug: "tempo-traveller", type: "TEMPO", seats: 17, bags: 10, ac: true, gps: true, rate: 26 },
  { name: "Dzire", slug: "dzire", type: "SEDAN", seats: 4, bags: 2, ac: true, gps: false, rate: 11 },
];

export function CarSearchResults({ search }: { search: SearchInput }) {
  const [vehicleType, setVehicleType] = useState("ALL");
  const [capacity, setCapacity] = useState("ALL");
  const [maxRate, setMaxRate] = useState(30);
  const [acOnly, setAcOnly] = useState(false);
  const [gpsOnly, setGpsOnly] = useState(false);
  const [sort, setSort] = useState("recommended");

  const filtered = useMemo(() => {
    const rows = vehicles.filter((vehicle) => {
      if (vehicleType !== "ALL" && vehicle.type !== vehicleType) return false;
      if (capacity === "UP_TO_6" && vehicle.seats > 6) return false;
      if (capacity === "7_12" && (vehicle.seats < 7 || vehicle.seats > 12)) return false;
      if (capacity === "13_17" && (vehicle.seats < 13 || vehicle.seats > 17)) return false;
      if (vehicle.rate > maxRate) return false;
      if (acOnly && !vehicle.ac) return false;
      if (gpsOnly && !vehicle.gps) return false;
      return true;
    });

    return [...rows].sort((a, b) => {
      if (sort === "price-low") return a.rate - b.rate;
      if (sort === "price-high") return b.rate - a.rate;
      if (sort === "capacity") return b.seats - a.seats;
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.rate - b.rate;
    });
  }, [vehicleType, capacity, maxRate, acOnly, gpsOnly, sort]);

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
        <Link className="button-link button-link--primary" href={`/?editSearch=1&${query.toString()}`}>Edit Search</Link>
      </div>

      <div className="shell search-results-layout search-results-layout--reference">
        <aside className="search-filter-panel">
          <div className="filter-title-row"><h2>Filters</h2><button type="button" onClick={() => { setVehicleType("ALL"); setCapacity("ALL"); setMaxRate(30); setAcOnly(false); setGpsOnly(false); }}>Clear All</button></div>

          <strong>Vehicle Type</strong>
          {[
            ["ALL","All Vehicles"],
            ["SUV","SUV"],
            ["SEDAN","Sedan"],
            ["TEMPO","Tempo Traveller"],
            ["LUXURY","Luxury"],
          ].map(([value,label]) => <label key={value}><input type="radio" name="vehicleType" checked={vehicleType===value} onChange={() => setVehicleType(value)} />{label}</label>)}

          <hr/>
          <strong>Seating Capacity</strong>
          {[
            ["ALL","Any capacity"],
            ["UP_TO_6","Up to 6"],
            ["7_12","7–12"],
            ["13_17","13–17"],
          ].map(([value,label]) => <label key={value}><input type="radio" name="capacity" checked={capacity===value} onChange={() => setCapacity(value)} />{label}</label>)}

          <hr/>
          <strong>Price Range (₹ / km)</strong>
          <input className="price-range" type="range" min="10" max="30" value={maxRate} onChange={(e)=>setMaxRate(Number(e.target.value))} />
          <div className="price-range-labels"><span>₹10</span><span>₹{maxRate}</span></div>

          <hr/>
          <strong>Features</strong>
          <label><input type="checkbox" checked={acOnly} onChange={(e)=>setAcOnly(e.target.checked)} />AC</label>
          <label><input type="checkbox" checked={gpsOnly} onChange={(e)=>setGpsOnly(e.target.checked)} />GPS Enabled</label>
        </aside>

        <div className="search-results">
          <div className="results-heading">
            <h1>{filtered.length} Cars Available</h1>
            <label>Sort by:
              <select value={sort} onChange={(e)=>setSort(e.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="capacity">Seating Capacity</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <div className="search-empty-state">
              <h2>No vehicles match these filters.</h2>
              <p>Clear one or more filters to see available vehicle classes.</p>
            </div>
          ) : filtered.map((vehicle) => (
            <article className="search-result-card search-result-card--reference" key={vehicle.slug}>
              <div className="search-result-card__image">
                <img src="/assets/car-innova.webp" alt={vehicle.name} loading="lazy"/>
                {vehicle.featured ? <span className="vehicle-card-badge">Best Value</span> : null}
              </div>
              <div className="search-result-card__body">
                <h2>{vehicle.name}</h2>
                <p>{vehicle.seats} Seats · {vehicle.type === "LUXURY" ? "Luxury" : vehicle.type === "TEMPO" ? "Group Travel" : "Comfort"}</p>
                <div className="result-specs"><span>♙ {vehicle.seats} Seats</span><span>▣ {vehicle.bags} Bags</span><span>❄ {vehicle.ac ? "AC" : "Non-AC"}</span></div>
                <ul>
                  <li>Driver included</li>
                  <li>Final fare calculated by server quote</li>
                  <li>Vehicle subject to availability</li>
                </ul>
              </div>
              <div className="search-result-card__price">
                <strong>₹ {vehicle.rate} / km</strong>
                <small>Indicative class rate</small>
                <Link className="button-link button-link--primary" href={`/booking/car?vehicle=${encodeURIComponent(vehicle.slug)}&${query.toString()}`}>Choose Vehicle →</Link>
                <Link href={vehicle.slug === "innova-crysta" ? "/cars/innova-crysta" : "/cars"}>View Details</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
