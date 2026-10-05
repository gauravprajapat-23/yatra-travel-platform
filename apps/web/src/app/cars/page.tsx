import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Cars & Fleet",
  description: "Explore YATRA chauffeur-driven cars for road journeys across India.",
};

const vehicles = [
  ["Innova Crysta", "Premium · 6 Seats", "₹ 14 / km"],
  ["Ertiga", "Comfort · 6 Seats", "₹ 12 / km"],
  ["Innova Hycross", "Premium Hybrid · 6 Seats", "₹ 16 / km"],
  ["Toyota Fortuner", "Luxury SUV · 6 Seats", "₹ 20 / km"],
  ["Tempo Traveller", "12–17 Seats · Group", "₹ 26 / km"],
  ["Luxury Vellfire", "Executive · 6 Seats", "₹ 28 / km"],
];

export default function CarsPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--fleet">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">OUR FLEET</p>
          <h1>Comfort for every<br />kind of journey.</h1>
          <p>Well-maintained, chauffeur-driven vehicles for temple tours, family trips and long-distance travel.</p>
          <div className="reference-hero-badges">
            <span>Clean Vehicles</span><span>Experienced Drivers</span><span>GPS Enabled</span><span>24×7 Support</span>
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          <div className="reference-filter-row">
            {["All Vehicles", "Sedan", "SUV", "Premium", "Tempo Traveller", "Luxury"].map((item, i) => (
              <button className={i === 0 ? "filter-chip filter-chip--active" : "filter-chip"} key={item}>{item}</button>
            ))}
          </div>

          <div className="vehicle-grid">
            {vehicles.map(([name, meta, price], index) => (
              <article className="vehicle-list-card" key={name}>
                <div className={`vehicle-list-card__image vehicle-list-card__image--${(index % 3) + 1}`}>
                  <div className="vehicle-list-card__car" />
                </div>
                <h2>{name}</h2>
                <p>{meta}</p>
                <div className="vehicle-list-card__specs"><span>6 Seats</span><span>4 Bags</span><span>AC</span></div>
                <strong>{price}</strong>
                <ButtonLink href="/custom-trip">View Details →</ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
