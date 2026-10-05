import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Destinations",
  description: "Discover temple towns, spiritual cities and road-trip destinations across India.",
};

const destinations = [
  { name: "Varanasi", meta: "Spiritual · Culture · Heritage", assetClass: "asset-destination--varanasi", href: "/destinations/varanasi" },
  { name: "Ujjain", meta: "Jyotirlinga · Sacred City", assetClass: "asset-temple--ujjain", href: "/packages" },
  { name: "Omkareshwar", meta: "Narmada · Jyotirlinga", assetClass: "asset-temple--omkareshwar", href: "/packages" },
  { name: "Kedarnath", meta: "Himalayas · Pilgrimage", assetClass: "asset-temple--kedarnath", href: "/temples/kedarnath" },
];

export default function DestinationsPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--destination">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">DISCOVER INDIA</p>
          <h1>Destinations with<br />a deeper story.</h1>
          <p>Sacred cities, mountain temples and meaningful road journeys — all in one place.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          <div className="destination-grid">
            {destinations.map((destination) => (
              <article
                className={`destination-card asset-sprite ${destination.assetClass}`}
                key={destination.name}
                aria-label={`${destination.name} travel destination in India`}
              >
                <div className="destination-card__shade" />
                <div className="destination-card__content">
                  <p>{destination.meta}</p>
                  <h2>{destination.name}</h2>
                  <ButtonLink href={destination.href} variant="ghost">Explore →</ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
