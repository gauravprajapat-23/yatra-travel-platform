import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Tour Packages",
  description: "Curated temple, heritage and road-trip packages across India.",
};

const packages = [
  ["Spiritual Ujjain – Omkareshwar", "3 Nights · 4 Days", "₹ 12,999"],
  ["Char Dham Yatra", "8 Nights · 9 Days", "₹ 28,999"],
  ["South India Temple Trail", "5 Nights · 6 Days", "₹ 18,499"],
  ["Rajasthan Heritage Explorer", "6 Nights · 7 Days", "₹ 21,999"],
  ["Kerala Backwaters Escape", "4 Nights · 5 Days", "₹ 16,999"],
  ["Varanasi Spiritual Journey", "3 Nights · 4 Days", "₹ 11,499"],
];

export default function PackagesPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--packages">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">CURATED JOURNEYS</p>
          <h1>Curated journeys<br />across incredible India.</h1>
          <p>Temple tours, weekend getaways, heritage trails and spiritual journeys crafted for meaningful travel.</p>
        </div>
      </section>

      <section className="package-search-strip">
        <div className="shell package-search-strip__inner">
          <input aria-label="Where do you want to go?" placeholder="Search destinations, e.g. Varanasi, Kerala..." />
          <select aria-label="Trip type"><option>Trip Type</option><option>Temple</option><option>Heritage</option></select>
          <select aria-label="Month"><option>Any month</option></select>
          <button className="button-link button-link--primary">Search Packages →</button>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          <div className="reference-section-heading">
            <p className="eyebrow">POPULAR TOUR PACKAGES</p>
            <h2 className="reference-title">Handpicked journeys for every kind of traveller.</h2>
          </div>
          <div className="package-grid">
            {packages.map(([name, duration, price], index) => (
              <article className="package-card" key={name}>
                <div className={`package-card__image package-card__image--${(index % 3) + 1}`} />
                <div className="package-card__body">
                  <h3>{name}</h3>
                  <p>{duration}</p>
                  <div className="package-card__footer">
                    <strong>{price} <small>/ person</small></strong>
                    <ButtonLink href="/custom-trip">View Details →</ButtonLink>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
