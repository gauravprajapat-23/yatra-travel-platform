import { ButtonLink } from "@/components/button-link";
import { HomeCarSearch } from "@/components/home-car-search";

export function HeroJourney() {
  return (
    <section className="reference-hero">
      <div className="reference-hero__backdrop" />
      <div className="reference-hero__shade" />

      <div className="shell reference-hero__content">
        <p className="eyebrow">PRIVATE ROAD JOURNEYS ACROSS INDIA</p>
        <h1>Your journey<br />begins here.</h1>
        <p className="reference-hero__lede">
          Premium chauffeur-driven cars, sacred temple circuits and curated
          long-distance tours — designed around you.
        </p>
        <div className="reference-hero__actions">
          <ButtonLink href="/cars">Explore Fleet</ButtonLink>
          <ButtonLink href="/packages" variant="ghost">
            Explore Tours
          </ButtonLink>
        </div>
      </div>

      <HomeCarSearch />

      <div className="shell reference-trust-row" aria-label="Travel assurances">
        <span>◉ Verified Drivers</span>
        <span>◉ Clean & Comfortable Cars</span>
        <span>◉ Transparent Pricing</span>
        <span>◉ 24×7 Support</span>
      </div>
    </section>
  );
}
