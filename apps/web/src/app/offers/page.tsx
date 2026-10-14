import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "India Tour & Car Booking Offers",
  description:
    "Check current YATRA travel promotions and request a server-verified quote for private cars, temple circuits and curated India tour packages.",
  alternates: { canonical: "/offers" },
  openGraph: {
    title: "India Tour & Car Booking Offers | YATRA",
    description:
      "Current verified YATRA travel promotions and private-trip quote options.",
    url: "/offers",
    images: [{ url: "/assets/packages-hero.webp", alt: "YATRA travel offers" }],
  },
};

export default function OffersPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--offers">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">TRAVEL OFFERS</p>
          <h1>Clear pricing.<br />No fake discounts.</h1>
          <p>
            Public offers are only shown when they are backed by an active
            server-side pricing or campaign rule.
          </p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell offers-safe-state">
          <article className="booking-card">
            <p className="eyebrow">CURRENT STATUS</p>
            <h2>No public promotional offers are active right now.</h2>
            <p>
              We do not publish percentage or cash discounts unless they can
              be verified and enforced by the booking backend. You can still
              request a custom journey and receive a server-reviewed quote.
            </p>
            <div className="reference-hero__actions">
              <ButtonLink href="/custom-trip">Request a Custom Quote →</ButtonLink>
              <ButtonLink href="/packages" variant="ghost">Browse Published Tours</ButtonLink>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
