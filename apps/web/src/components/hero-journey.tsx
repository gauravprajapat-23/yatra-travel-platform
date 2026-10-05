import { ButtonLink } from "@/components/button-link";

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
          <ButtonLink href="/cars">Find a Car</ButtonLink>
          <ButtonLink href="/packages" variant="ghost">
            Explore Tours
          </ButtonLink>
        </div>
      </div>

      <div className="shell reference-search-card">
        {[
          ["From", "Raipur"],
          ["To", "Ujjain"],
          ["Departure", "12 Oct"],
          ["Return", "15 Oct"],
          ["Travellers", "4"],
        ].map(([label, value]) => (
          <div className="reference-search-card__field" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <ButtonLink href="/cars">Find Cars →</ButtonLink>
      </div>

      <div className="shell reference-trust-row" aria-label="Travel assurances">
        <span>◉ Verified Drivers</span>
        <span>◉ Clean & Comfortable Cars</span>
        <span>◉ Transparent Pricing</span>
        <span>◉ 24×7 Support</span>
      </div>
    </section>
  );
}
