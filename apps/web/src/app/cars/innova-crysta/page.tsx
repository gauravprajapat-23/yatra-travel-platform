import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = { title: "Toyota Innova Crysta" };

export default function CarDetailPage() {
  const routes = [
    ["Ujjain → Omkareshwar", "2 Days · 450 km"],
    ["Ujjain → Mahakaleshwar → Indore", "3 Days · 520 km"],
    ["Nashik → Trimbakeshwar", "2 Days · 360 km"],
  ];

  return (
    <section className="reference-section reference-section--cream car-detail-reference">
      <div className="shell car-detail-top">
        <div className="car-detail-gallery">
          <div className="car-detail-gallery__main">
            <span className="vehicle-card-badge">Most Popular</span>
            <img src="/assets/car-innova.webp" alt="Toyota Innova Crysta for YATRA chauffeur-driven journeys"/>
          </div>
          <div className="car-detail-gallery__thumbs">
            <img src="/assets/car-innova.webp" alt="Innova exterior" />
            <img src="/assets/temple-hero.webp" alt="Pilgrimage road journey" />
            <img src="/assets/car-innova.webp" alt="Innova side view" />
            <div className="car-gallery-more">+6 Photos</div>
          </div>
        </div>

        <div className="car-detail-summary">
          <div className="car-detail-heading-row">
            <div>
              <h1>Toyota Innova Crysta</h1>
              <p>Premium · 6 Seats · Ideal for family and long tours</p>
            </div>
            <button aria-label="Save vehicle" className="car-save-button">♡</button>
          </div>

          <div className="rating-row">★★★★★ <strong>4.8</strong> <span>(320+ reviews)</span></div>

          <div className="spec-icon-grid">
            <span>♙<b>6 Seats</b></span>
            <span>▣<b>4 Bags</b></span>
            <span>❄<b>AC</b></span>
            <span>◈<b>Diesel</b></span>
            <span>⌖<b>GPS</b></span>
          </div>

          <div className="car-price-panel">
            <strong>₹ 14 / km</strong>
            <small>Driver, fuel, toll & state permit included</small>
            <ButtonLink href="/booking/car">Book This Car →</ButtonLink>
          </div>
        </div>
      </div>

      <div className="shell car-detail-tabs" role="tablist" aria-label="Car details">
        {["Overview","Amenities","Inclusions","Driver","Reviews"].map((x,i)=><button className={i===0?"active":""} key={x}>{x}</button>)}
      </div>

      <div className="shell car-detail-body">
        <article>
          <h2>A perfect choice for comfortable<br/>and worry-free travel.</h2>
          <p>The Innova Crysta offers exceptional comfort, reliability and space — ideal for temple circuits, long-distance tours and family travel across India.</p>
          <div className="benefit-grid">
            {["Spacious Interiors","Reliable Performance","Ideal for Families","Perfect for Pilgrimages"].map((x)=><span key={x}>◎ <b>{x}</b></span>)}
          </div>
        </article>

        <aside>
          <h3>Popular Routes for This Car</h3>
          {routes.map(([route,meta])=>(
            <div className="route-mini" key={route}>
              <span>{route}</span>
              <small>{meta}</small>
              <strong>View Tour →</strong>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}
