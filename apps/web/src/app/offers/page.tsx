import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Travel Offers",
  description: "Seasonal YATRA offers for temple tours, road trips and custom journeys.",
};

const offers = [
  { tag: "Festive Offer", title: "Char Dham Yatra Special", saving: "Up to ₹10,000 OFF", assetClass: "asset-vp--char-dham" },
  { tag: "Limited Time", title: "Uttarakhand Temple Tours", saving: "Flat 15% OFF", assetClass: "asset-temple--kedarnath" },
  { tag: "Car Rental Offer", title: "Long Distance Travel", saving: "Up to 20% OFF", assetClass: "asset-vp--fortuner" },
  { tag: "Group Offer", title: "Family & Group Bookings", saving: "Special group rates", assetClass: "asset-vp--tempo" },
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
          {offers.map((offer) => (
            <article className="offer-card" key={offer.title}>
              <div
                className={`offer-card__visual asset-sprite ${offer.assetClass}`}
                role="img"
                aria-label={`${offer.title} travel offer`}
              >
                <span>{offer.tag}</span>
              </div>
              <div className="offer-card__body">
                <h2>{offer.title}</h2>
                <strong>{offer.saving}</strong>
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
