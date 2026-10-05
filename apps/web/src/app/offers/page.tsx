import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Travel Offers",
  description: "Seasonal YATRA offers for temple tours, road trips and custom journeys.",
};

const offers = [
  ["Festive Offer", "Char Dham Yatra Special", "Up to ₹10,000 OFF", "/assets/packages-hero.webp"],
  ["Limited Time", "Uttarakhand Temple Tours", "Flat 15% OFF", "/assets/packages-hero.webp"],
  ["Car Rental Offer", "Long Distance Travel", "Up to 20% OFF", "/assets/home-hero.webp"],
  ["Group Offer", "Family & Group Bookings", "Special group rates", "/assets/fleet-hero.webp"],
];

export default function OffersPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--offers">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">LIMITED TIME OFFERS</p>
          <h1>Sacred journeys.<br />Special savings.</h1>
          <p>Book temple tours, long-distance journeys and custom trips with clear, transparent offers.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell offer-grid">
          {offers.map(([tag, title, saving, image]) => (
            <article className="offer-card" key={title}>
              <div className="offer-card__visual">
                <img src={image} alt={`${title} travel offer`} loading="lazy" />
                <span>{tag}</span>
              </div>
              <div className="offer-card__body">
                <h2>{title}</h2>
                <strong>{saving}</strong>
                <p>Selected dates and availability. Final eligibility is verified at booking.</p>
                <ButtonLink href="/custom-trip">Book Now →</ButtonLink>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
