import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Trip Builder",
  description: "Build a custom chauffeur-driven journey with YATRA.",
  robots: { index: false, follow: false },
};

export default function CustomTripPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--custom">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">PLAN YOUR OWN JOURNEY</p>
          <h1>Custom Trip Builder.</h1>
          <p>Tell us your route plans and we&apos;ll create the perfect itinerary with the right car, route and experience.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell trip-builder">
          <form className="trip-builder__form">
            <h2>Trip Details</h2>
            <div className="trip-builder__grid">
              <label>From<input defaultValue="Delhi" /></label>
              <label>To<input defaultValue="Kedarnath" /></label>
              <label>Duration<select defaultValue="6"><option value="6">6 Days</option></select></label>
              <label>Travel Date<input type="date" /></label>
              <label>No. of Travellers<input type="number" min="1" defaultValue="4" /></label>
              <label>Preferred Vehicle<select><option>SUV · 6 Seats</option><option>Tempo Traveller</option></select></label>
            </div>
            <label>Special Requests<textarea placeholder="Senior citizens, extra luggage, temple darshan, specific hotels..." /></label>
            <button className="button-link button-link--primary" type="button">Create My Trip →</button>
          </form>

          <aside className="trip-builder__summary">
            <p className="eyebrow">LIVE PACKAGE SUMMARY</p>
            <h2>Estimated Price</h2>
            <strong className="trip-builder__price">₹48,000</strong>
            <p>For 6 Days · 4 Travellers</p>
            <div className="trip-builder__route">
              <span>Day 1 · Delhi → Haridwar</span>
              <span>Day 2 · Rishikesh → Guptkashi</span>
              <span>Day 3 · Kedarnath</span>
              <span>Day 4 · Badrinath</span>
              <span>Day 5 · Rudraprayag</span>
              <span>Day 6 · Return</span>
            </div>
            <small>This is a design preview. Final price remains server-authoritative.</small>
          </aside>
        </div>
      </section>
    </>
  );
}
