import type { Metadata } from "next";
import Link from "next/link";
import { getPublicDestinations } from "@/lib/public-destinations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Destinations",
  description: "Discover published temple towns, spiritual cities and road-trip destinations across India.",
};

export default async function DestinationsPage() {
  const destinations = await getPublicDestinations();

  return (
    <>
      <section className="reference-page-hero reference-page-hero--destination">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">DISCOVER INDIA</p>
          <h1>Destinations with<br />a deeper story.</h1>
          <p>Published sacred cities, mountain temples and meaningful road journeys — managed from the YATRA CMS.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          {destinations.length ? (
            <div className="destination-grid">
              {destinations.map((destination) => (
                <article
                  className="destination-card"
                  key={destination.id}
                  style={{
                    backgroundImage: `url("${destination.heroUrl || "/assets/temple-hero.webp"}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="destination-card__shade" />
                  <div className="destination-card__content">
                    <p>{destination.kind.replaceAll("_", " ")}</p>
                    <h2>{destination.name}</h2>
                    {destination.summary ? <p>{destination.summary}</p> : null}
                    <Link className="button-link button-link--ghost" href={`/destinations/${destination.slug}`}>
                      Explore →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <h2>No destinations are published yet.</h2>
              <p>Please use the custom trip request while destination content is being prepared.</p>
              <Link className="button-link button-link--primary" href="/custom-trip">
                Plan a Custom Trip →
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
