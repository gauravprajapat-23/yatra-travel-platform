import { ButtonLink } from "@/components/button-link";
import { HeroJourney } from "@/components/hero-journey";

const sacredJourneys = [
  { title: "Mahakaleshwar", place: "Ujjain", assetClass: "asset-temple--ujjain" },
  { title: "Omkareshwar", place: "Narmada", assetClass: "asset-temple--omkareshwar" },
  { title: "Rameswaram", place: "Tamil Nadu", assetClass: "asset-temple--rameswaram" },
];

const fleet = [
  { name: "Innova Crysta", meta: "Premium · 6 Seats", price: "₹ 14 / km", assetClass: "asset-vp--innova" },
  { name: "Ertiga", meta: "Comfort · 6 Seats", price: "₹ 12 / km", assetClass: "asset-vp--ertiga" },
  { name: "Toyota Fortuner", meta: "Luxury SUV · 6 Seats", price: "₹ 20 / km", assetClass: "asset-vp--fortuner" },
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
                <div
                  className={`journey-card__image asset-sprite ${journey.assetClass}`}
                  role="img"
                  aria-label={`${journey.title} temple journey in ${journey.place}`}
                />
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
                <div
                  className={`fleet-card__visual asset-sprite ${car.assetClass}`}
                  role="img"
                  aria-label={`${car.name} chauffeur-driven vehicle`}
                />
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
