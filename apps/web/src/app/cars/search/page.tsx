import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = { title: "Car Search Results", robots: { index: false, follow: false } };

const cars = [
  ["Innova Crysta","6 Seats · Premium","₹ 14 / km","₹ 12,600"],
  ["Ertiga","6 Seats · Comfort","₹ 12 / km","₹ 10,800"],
  ["Toyota Fortuner","6 Seats · Luxury","₹ 20 / km","₹ 18,000"],
  ["Tempo Traveller","12–17 Seats · Group Travel","₹ 26 / km","₹ 23,400"],
];

export default function CarSearchPage() {
  return (
    <section className="reference-section reference-section--cream car-search-reference">
      <div className="shell route-summary-bar route-summary-bar--reference">
        <span><small>FROM</small><b>Raipur</b><em>Chhattisgarh</em></span>
        <b className="route-arrow">→</b>
        <span><small>TO</small><b>Ujjain</b><em>Madhya Pradesh</em></span>
        <span><small>DEPARTURE</small><b>12 Oct 2024</b><em>Departure</em></span>
        <span><small>RETURN</small><b>15 Oct 2024</b><em>Return</em></span>
        <span><small>TRAVELLERS</small><b>4</b><em>Travellers</em></span>
        <ButtonLink href="/cars/search">Edit Search</ButtonLink>
      </div>

      <div className="shell search-results-layout search-results-layout--reference">
        <aside className="search-filter-panel">
          <div className="filter-title-row"><h2>Filters</h2><button>Clear All</button></div>
          <strong>Vehicle Type</strong>
          {["All Vehicles","SUV","Sedan","Tempo Traveller","Luxury"].map((x,i)=><label key={x}><input type="checkbox" defaultChecked={i===0}/>{x}</label>)}
          <hr/>
          <strong>Seating Capacity</strong>
          {["Up to 6","7–12","13–17"].map((x,i)=><label key={x}><input type="checkbox" defaultChecked={i===0}/>{x}</label>)}
          <hr/>
          <strong>Price Range (₹ / km)</strong>
          <input className="price-range" type="range" min="10" max="30" defaultValue="22" />
          <div className="price-range-labels"><span>₹10</span><span>₹30</span></div>
          <hr/>
          <strong>Features</strong>
          {["AC","Driver Included","GPS Enabled","Extra Luggage Space"].map((x,i)=><label key={x}><input type="checkbox" defaultChecked={i<2}/>{x}</label>)}
          <hr/>
          <strong>Sort By</strong>
          <select><option>Recommended</option></select>
        </aside>

        <div className="search-results">
          <div className="results-heading">
            <h1>12 Cars Available</h1>
            <label>Sort by: <select><option>Recommended</option></select></label>
          </div>

          {cars.map(([name,meta,rate,total],i)=>(
            <article className="search-result-card search-result-card--reference" key={name}>
              <div className="search-result-card__image">
                <img src="/assets/car-innova.webp" alt={name} loading="lazy"/>
                {i===0 ? <span className="vehicle-card-badge">Best Value</span> : null}
              </div>
              <div className="search-result-card__body">
                <h2>{name}</h2>
                <p>{meta}</p>
                <div className="result-specs"><span>♙ 6 Seats</span><span>▣ 4 Bags</span><span>❄ AC</span></div>
                <ul>
                  <li>Driver, fuel & toll included</li>
                  <li>Clean & well maintained</li>
                  <li>Experienced driver</li>
                </ul>
              </div>
              <div className="search-result-card__price">
                <strong>{rate}</strong>
                <small>Total (approx) <b>{total}</b></small>
                <ButtonLink href="/cars/innova-crysta">Choose Vehicle →</ButtonLink>
                <a href="/cars/innova-crysta">View Details</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
