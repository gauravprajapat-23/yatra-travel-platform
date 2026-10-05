import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Cars & Fleet",
  description: "Explore YATRA chauffeur-driven cars for road journeys across India.",
};

const vehicles = [
  { name: "Innova Crysta", meta: "Premium · 6 Seats", price: "₹ 14 / km", seats: "6 Seats", bags: "4 Bags", href: "/cars/innova-crysta", badge: "Most Popular" },
  { name: "Ertiga", meta: "Comfort · 6 Seats", price: "₹ 12 / km", seats: "6 Seats", bags: "4 Bags", href: "/custom-trip" },
  { name: "Innova Hycross", meta: "Premium Hybrid · 6 Seats", price: "₹ 16 / km", seats: "6 Seats", bags: "4 Bags", href: "/custom-trip" },
  { name: "Toyota Fortuner", meta: "Luxury SUV · 6 Seats", price: "₹ 20 / km", seats: "6 Seats", bags: "4 Bags", href: "/custom-trip" },
  { name: "Tempo Traveller", meta: "12–17 Seats · Group", price: "₹ 26 / km", seats: "12+ Seats", bags: "10 Bags", href: "/custom-trip" },
  { name: "Luxury Vellfire", meta: "Executive · 6 Seats", price: "₹ 28 / km", seats: "6 Seats", bags: "5 Bags", href: "/custom-trip" },
];

export default function CarsPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--fleet fleet-reference-hero">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">OUR FLEET</p>
          <h1>Comfort for every<br />kind of journey.</h1>
          <p>Well-maintained, chauffeur-driven vehicles for temple tours, family trips and long-distance travel across India.</p>
          <div className="reference-hero-badges">
            <span>◉ Clean Vehicles</span>
            <span>◉ Experienced Drivers</span>
            <span>◉ GPS Enabled</span>
            <span>◉ 24×7 Support</span>
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream fleet-reference-section">
        <div className="shell">
          <div className="reference-filter-row fleet-reference-filters">
            {["All Vehicles", "Sedan", "SUV", "Premium", "Tempo Traveller", "Luxury"].map((item, i) => (
              <button className={i === 0 ? "filter-chip filter-chip--active" : "filter-chip"} key={item}>{item}</button>
            ))}
          </div>

          <div className="vehicle-grid vehicle-grid--reference">
            {vehicles.map((vehicle) => (
              <article className="vehicle-list-card vehicle-list-card--reference" key={vehicle.name}>
                <div className="vehicle-list-card__image">
                  <img src="/assets/car-innova.webp" alt={vehicle.name} loading="lazy" />
                  {vehicle.badge ? <span className="vehicle-card-badge">{vehicle.badge}</span> : null}
                </div>
                <h2>{vehicle.name}</h2>
                <p>{vehicle.meta}</p>
                <div className="vehicle-list-card__specs">
                  <span>♙ {vehicle.seats}</span>
                  <span>▣ {vehicle.bags}</span>
                  <span>❄ AC</span>
                </div>
                <strong>{vehicle.price}</strong>
                <small className="vehicle-list-card__included">Driver, fuel & toll included</small>
                <ButtonLink href={vehicle.href}>View Details →</ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
