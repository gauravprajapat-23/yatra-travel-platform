import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Tour Packages",
  description: "Curated temple, heritage and road-trip packages across India.",
};

const packages = [
  { name: "Spiritual Ujjain – Omkareshwar", duration: "3 Nights · 4 Days", price: "₹ 12,999", assetClass: "asset-temple--ujjain" },
  { name: "Char Dham Yatra", duration: "8 Nights · 9 Days", price: "₹ 28,999", assetClass: "asset-vp--char-dham" },
  { name: "South India Temple Trail", duration: "5 Nights · 6 Days", price: "₹ 18,499", assetClass: "asset-vp--south-india" },
  { name: "Rajasthan Heritage Explorer", duration: "6 Nights · 7 Days", price: "₹ 21,999", assetClass: "asset-vp--rajasthan" },
  { name: "Kerala Backwaters Escape", duration: "4 Nights · 5 Days", price: "₹ 16,999", assetClass: "asset-vp--kerala" },
  { name: "Varanasi Spiritual Journey", duration: "3 Nights · 4 Days", price: "₹ 11,499", assetClass: "asset-destination--varanasi" },
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
            {packages.map((pkg) => (
              <article className="package-card" key={pkg.name}>
                <div
                  className={`package-card__image asset-sprite ${pkg.assetClass}`}
                  role="img"
                  aria-label={`${pkg.name} tour package`}
                />
                <div className="package-card__body">
                  <h3>{pkg.name}</h3>
                  <p>{pkg.duration}</p>
                  <div className="package-card__footer">
                    <strong>{pkg.price} <small>/ person</small></strong>
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
