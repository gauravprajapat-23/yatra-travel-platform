import { ButtonLink } from "@/components/button-link";

export function HeroJourney() {
  return (
    <section className="hero">
      <div className="shell hero__grid">
        <div className="hero__copy">
          <p className="eyebrow">PRIVATE ROAD JOURNEYS ACROSS INDIA</p>
          <h1>Your journey begins here.</h1>
          <p className="hero__lede">
            Premium chauffeur-driven cars, sacred temple circuits and curated
            long-distance tours — designed around your pace.
          </p>
          <div className="hero__actions">
            <ButtonLink href="/cars">Book a Car</ButtonLink>
            <ButtonLink href="/packages" variant="dark">
              Explore Tours
            </ButtonLink>
          </div>
          <ul className="hero__trust" aria-label="Travel assurances">
            <li>Verified drivers</li>
            <li>Clean vehicles</li>
            <li>Transparent pricing</li>
          </ul>
        </div>

        <div
          aria-label="A stylised road journey from the hills toward a temple destination"
          className="journey-art"
          role="img"
        >
          <span className="journey-art__sun" />
          <span className="journey-art__mountain journey-art__mountain--one" />
          <span className="journey-art__mountain journey-art__mountain--two" />
          <span className="journey-art__temple" />
          <span className="journey-art__road" />
          <span className="journey-art__car" />
        </div>
      </div>

      <p className="shell hero__motion-note">
        Motion direction: city → highway → forest → temple → destination.
      </p>
    </section>
  );
}
