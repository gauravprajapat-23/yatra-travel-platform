import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "About YATRA",
  description: "Learn about YATRA, our values and our approach to premium road journeys across India.",
};

export default function AboutPage() {
  return (
    <>
      <section className="story-hero story-hero--about">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">ABOUT YATRA</p>
          <h1>Driven by a deeper<br />love for India.</h1>
          <p>Premium travel experiences, curated journeys and reliable chauffeur-driven travel across India.</p>
          <div className="story-stats">
            <span><strong>Private</strong> Chauffeur-driven journeys</span>
            <span><strong>Flexible</strong> Custom itineraries</span>
            <span><strong>Transparent</strong> Server-verified quotes</span>
            <span><strong>Support</strong> Before and during travel</span>
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell about-story-grid">
          <div>
            <p className="eyebrow">OUR STORY</p>
            <h2 className="reference-title">Travel that feels personal.</h2>
            <p className="reference-copy">YATRA was built around a simple idea: help travellers experience India in comfort, safety and style. Reliable cars, thoughtful itineraries and transparent service sit at the heart of every journey.</p>
            <ButtonLink href="/custom-trip">Plan a Journey →</ButtonLink>
          </div>
          <div
            className="about-image-panel asset-sprite asset-destination--udaipur"
            role="img"
            aria-label="Indian destination landscape representing the YATRA story"
          />
        </div>

        <div className="shell value-grid">
          {[
            ["Safety First","Your well-being is our priority."],
            ["Authentic Experiences","Real India, beyond the usual."],
            ["Trusted Service","Reliable drivers and support."],
            ["Sustainable Travel","Supporting local communities."],
          ].map(([title,copy]) => (
            <article className="value-card" key={title}>
              <span className="value-card__icon">✦</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
