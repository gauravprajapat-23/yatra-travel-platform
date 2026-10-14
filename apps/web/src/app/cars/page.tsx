import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { getPublicFleet } from "@/lib/public-fleet";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chauffeur-Driven Cars for India Road Trips",
  description:
    "Explore YATRA chauffeur-driven Innova, MUV and SUV options for private road trips, temple tours, airport transfers and family travel across India.",
  alternates: { canonical: "/cars" },
  openGraph: {
    title: "Chauffeur-Driven Cars for India Road Trips | YATRA",
    description:
      "Private chauffeur-driven cars for temple tours, family trips and long-distance journeys across India.",
    url: "/cars",
    images: [{ url: "/assets/car-innova.webp", alt: "YATRA chauffeur-driven car fleet" }],
  },
};

export default async function CarsPage() {
  const vehicles = await getPublicFleet();

  return (
    <>
      <section className="reference-page-hero reference-page-hero--fleet fleet-reference-hero">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">OUR FLEET</p>
          <h1>Comfort for every<br />kind of journey.</h1>
          <p>Active, chauffeur-driven vehicles for temple tours, family trips and long-distance travel across India.</p>
          <div className="reference-hero-badges">
            <span>◉ Active Fleet Only</span>
            <span>◉ Server-Verified Quote</span>
            <span>◉ Vehicle Availability Checked</span>
            <span>◉ Travel Support</span>
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream fleet-reference-section">
        <div className="shell">
          {vehicles.length ? (
            <div className="vehicle-grid vehicle-grid--reference">
              {vehicles.map((vehicle) => (
                <article className="vehicle-list-card vehicle-list-card--reference" key={vehicle.id}>
                  <div className="vehicle-list-card__image">
                    <img
                      src={vehicle.primaryImageUrl ?? "/assets/car-innova.webp"}
                      alt={vehicle.displayName}
                      loading="lazy"
                    />
                    {vehicle.isFeatured ? <span className="vehicle-card-badge">Featured</span> : null}
                  </div>
                  <h2>{vehicle.displayName}</h2>
                  <p>{vehicle.className}</p>
                  <div className="vehicle-list-card__specs">
                    <span>♙ {vehicle.seats} Seats</span>
                    <span>▣ {vehicle.luggage ?? "—"} Bags</span>
                    <span>❄ {vehicle.airConditioned ? "AC" : "Non-AC"}</span>
                  </div>
                  <strong>Server quote</strong>
                  <small className="vehicle-list-card__included">Final price depends on route and active pricing rules</small>
                  <ButtonLink href={`/cars/${vehicle.slug}`}>
                    View Details →
                  </ButtonLink>
                </article>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <h2>No active vehicles are published yet.</h2>
              <p>Use the custom trip request while the fleet is being configured.</p>
              <ButtonLink href="/custom-trip">Request a Trip →</ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
