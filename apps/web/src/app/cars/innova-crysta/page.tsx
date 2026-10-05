import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = { title: "Toyota Innova Crysta" };

export default function CarDetailPage() {
  return (
    <section className="reference-section reference-section--cream">
      <div className="shell car-detail-top">
        <div className="car-detail-gallery">
          <div className="car-detail-gallery__main"><img src="/assets/car-innova.webp" alt="Toyota Innova Crysta for YATRA chauffeur-driven journeys"/></div>
          <div className="car-detail-gallery__thumbs">
            {["/assets/car-innova.webp","/assets/fleet-hero.webp","/assets/car-ertiga.webp","/assets/car-fortuner.webp"].map((src,i)=><img src={src} alt={`Innova Crysta gallery view ${i+1}`} loading="lazy" key={src+i}/>)}
          </div>
        </div>
        <div className="car-detail-summary"><span className="reference-badge">Most Popular</span><h1>Toyota Innova Crysta</h1><p>Premium · 6 Seats · Ideal for family and long tours</p><div className="rating-row">★★★★★ <strong>4.8</strong> (320+ reviews)</div><div className="spec-icon-grid"><span>6 Seats</span><span>4 Bags</span><span>AC</span><span>Diesel</span><span>GPS</span></div><div className="car-price-panel"><strong>₹14 / km</strong><small>Driver, fuel, toll & state permit included</small><ButtonLink href="/booking/car">Book This Car →</ButtonLink></div></div>
      </div>

      <div className="shell car-detail-body">
        <article><h2>A perfect choice for comfortable and worry-free travel.</h2><p>The Innova Crysta offers exceptional comfort, reliability and space — ideal for temple circuits, long-distance tours and family travel across India.</p><div className="benefit-grid">{["Spacious Interiors","Reliable Performance","Ideal for Families","Perfect for Pilgrimages"].map(x=><span key={x}>{x}</span>)}</div></article>
        <aside><h3>Popular Routes for This Car</h3>{["Ujjain → Omkareshwar","Ujjain → Mahakaleshwar → Indore","Nashik → Trimbakeshwar"].map(x=><div className="route-mini" key={x}>{x}<strong>View Tour →</strong></div>)}</aside>
      </div>
    </section>
  );
}
