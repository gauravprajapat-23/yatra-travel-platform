import { ButtonLink } from "@/components/button-link";
import { HeroJourney } from "@/components/hero-journey";
import { getPublicFleet } from "@/lib/public-fleet";

export const dynamic = "force-dynamic";

const sacredJourneys = [
  { title: "Mahakaleshwar", place: "Ujjain", objectPosition: "22% center" },
  { title: "Omkareshwar", place: "Narmada", objectPosition: "52% center" },
  { title: "Rameswaram", place: "Tamil Nadu", objectPosition: "82% center" },
];

export default async function HomePage() {
  const fleet = (await getPublicFleet()).slice(0, 3);

  return (
    <>
      <HeroJourney />

      <section className="reference-section reference-section--cream">
        <div className="shell reference-split">
          <div>
            <p className="eyebrow">SACRED JOURNEYS</p>
            <h2 className="reference-title">Sacred journeys.<br />Unforgettable stories.</h2>
            <p className="reference-copy">
              From Jyotirlinga pilgrimages to spiritual getaways, experience
              India&apos;s most revered destinations with comfort, safety and
              trusted drivers.
            </p>
            <ButtonLink href="/packages">Explore Tours →</ButtonLink>
          </div>

          <div className="reference-card-grid reference-card-grid--three">
            {sacredJourneys.map((journey) => (
              <article className="journey-card" key={journey.title}>
                <div className="journey-card__image">
                  <img
                    src="/assets/temple-hero.webp"
                    alt={`${journey.title} temple journey in ${journey.place}`}
                    loading="lazy"
                    style={{ objectPosition: journey.objectPosition }}
                  />
                </div>
                <div className="journey-card__body">
                  <h3>{journey.title}</h3>
                  <p>{journey.place}</p>
                  <ButtonLink href="/packages" variant="ghost">View tours →</ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--forest">
        <div className="shell">
          <div className="reference-section-heading reference-section-heading--row">
            <div>
              <p className="eyebrow">OUR FLEET</p>
              <h2 className="reference-title reference-title--light">Travel in exceptional comfort.</h2>
              <p>Active, chauffeur-driven vehicles available for real trip requests.</p>
            </div>
            <ButtonLink href="/cars" variant="ghost">View all cars →</ButtonLink>
          </div>

          {fleet.length ? (
            <div className="reference-card-grid reference-card-grid--three">
              {fleet.map((car) => (
                <article className="fleet-card" key={car.id}>
                  <div className="fleet-card__visual">
                    <img
                      src="/assets/car-innova.webp"
                      alt={car.displayName}
                      loading="lazy"
                    />
                  </div>
                  <div className="fleet-card__body">
                    <h3>{car.displayName}</h3>
                    <p>{car.className} · {car.seats} Seats</p>
                    <strong>Server quote</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="fleet-empty-state">
              <p>No vehicles are currently published. Please use the Custom Trip form and our team will assist.</p>
              <ButtonLink href="/custom-trip">Request a Trip →</ButtonLink>
            </div>
          )}
        </div>
      </section>

      <section className="reference-journey-cta">
        <div className="shell reference-journey-cta__inner">
          <div className="reference-journey-cta__panel">
            <p className="eyebrow">CUSTOM JOURNEYS</p>
            <h2>Ready for your next great journey?</h2>
            <p>Tell us where you want to go. We&apos;ll build the perfect route around you.</p>
            <ButtonLink href="/custom-trip">Plan My Trip →</ButtonLink>
          </div>
          <div className="reference-journey-cta__features">
            <span>Temple Circuits</span><span>Long Trips</span><span>Custom Itineraries</span>
          </div>
        </div>
      </section>
    </>
  );
}
