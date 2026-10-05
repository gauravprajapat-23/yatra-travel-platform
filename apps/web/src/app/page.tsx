import { ButtonLink } from "@/components/button-link";
import { HeroJourney } from "@/components/hero-journey";

const sacredJourneys = [
  { title: "Mahakaleshwar", place: "Ujjain", objectPosition: "22% center" },
  { title: "Omkareshwar", place: "Narmada", objectPosition: "52% center" },
  { title: "Rameswaram", place: "Tamil Nadu", objectPosition: "82% center" },
];

const fleet = [
  { name: "Innova Crysta", meta: "Premium · 6 Seats", price: "₹ 14 / km", objectPosition: "center" },
  { name: "Ertiga", meta: "Comfort · 6 Seats", price: "₹ 12 / km", objectPosition: "46% center" },
  { name: "Toyota Fortuner", meta: "Luxury SUV · 6 Seats", price: "₹ 20 / km", objectPosition: "58% center" },
];

export default function HomePage() {
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
                  <ButtonLink href="/packages" variant="ghost">View tour →</ButtonLink>
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
              <p>Modern, well-maintained vehicles for every kind of journey.</p>
            </div>
            <ButtonLink href="/cars" variant="ghost">View all cars →</ButtonLink>
          </div>

          <div className="reference-card-grid reference-card-grid--three">
            {fleet.map((car) => (
              <article className="fleet-card" key={car.name}>
                <div className="fleet-card__visual">
                  <img
                    src="/assets/car-innova.webp"
                    alt={`${car.name} chauffeur-driven vehicle`}
                    loading="lazy"
                    style={{ objectPosition: car.objectPosition }}
                  />
                </div>
                <div className="fleet-card__body">
                  <h3>{car.name}</h3>
                  <p>{car.meta}</p>
                  <strong>{car.price}</strong>
                </div>
              </article>
            ))}
          </div>
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
