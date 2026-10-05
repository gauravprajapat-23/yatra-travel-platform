import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = { title: "Car Search Results", robots: { index: false, follow: false } };

const cars = [
  ["Innova Crysta","6 Seats · Premium","₹14 / km","₹12,600"],
  ["Ertiga","6 Seats · Comfort","₹12 / km","₹10,800"],
  ["Toyota Fortuner","6 Seats · Luxury","₹20 / km","₹18,000"],
  ["Tempo Traveller","12–17 Seats · Group","₹26 / km","₹23,400"],
];

export default function CarSearchPage() {
  return (
    <section className="reference-section reference-section--cream">
      <div className="shell route-summary-bar">
        <span><small>FROM</small>Raipur</span><b>→</b><span><small>TO</small>Ujjain</span><span><small>DEPARTURE</small>12 Oct</span><span><small>RETURN</small>15 Oct</span><span><small>TRAVELLERS</small>4</span><ButtonLink href="/cars/search">Edit Search</ButtonLink>
      </div>

      <div className="shell search-results-layout">
        <aside className="search-filter-panel">
          <h2>Filters</h2>
          {["All Vehicles","SUV","Sedan","Tempo Traveller","Luxury"].map((x,i)=><label key={x}><input type="checkbox" defaultChecked={i===0}/>{x}</label>)}
          <hr/><strong>Features</strong>
          {["AC","Driver Included","GPS Enabled","Extra Luggage Space"].map((x,i)=><label key={x}><input type="checkbox" defaultChecked={i<2}/>{x}</label>)}
        </aside>
        <div className="search-results">
          <div className="results-heading"><h1>12 Cars Available</h1><select><option>Recommended</option></select></div>
          {cars.map(([name,meta,rate,total],i)=><article className="search-result-card" key={name}><div className={`search-result-card__image vehicle-list-card__image--${(i%3)+1}`}><div className="vehicle-list-card__car"/></div><div className="search-result-card__body"><h2>{name}</h2><p>{meta}</p><ul><li>Driver, fuel & toll included</li><li>Clean & well maintained</li><li>Experienced driver</li></ul></div><div className="search-result-card__price"><strong>{rate}</strong><small>Total approx. {total}</small><ButtonLink href="/cars/innova-crysta">Choose Vehicle →</ButtonLink></div></article>)}
        </div>
      </div>
    </section>
  );
}
