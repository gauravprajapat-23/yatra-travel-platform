import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Destinations",
  description: "Discover temple towns, spiritual cities and road-trip destinations across India.",
};

const destinations = [
  ["Varanasi", "Spiritual · Culture · Heritage", "/assets/packages-hero.webp", "/destinations/varanasi"],
  ["Ujjain", "Jyotirlinga · Sacred City", "/assets/home-hero.webp", "/packages"],
  ["Omkareshwar", "Narmada · Jyotirlinga", "/assets/packages-hero.webp", "/packages"],
  ["Kedarnath", "Himalayas · Pilgrimage", "/assets/packages-hero.webp", "/temples/kedarnath"],
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
            {destinations.map(([name, meta, image, href]) => (
              <article className="destination-card" key={name}>
                <img className="destination-card__image" src={image} alt={`${name} travel destination in India`} loading="lazy" />
                <div className="destination-card__shade" />
                <div className="destination-card__content">
                  <p>{meta}</p>
                  <h2>{name}</h2>
                  <ButtonLink href={href} variant="ghost">Explore →</ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
