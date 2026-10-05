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
            <span><strong>10+</strong> Years of Experience</span>
            <span><strong>50,000+</strong> Happy Travellers</span>
            <span><strong>24+</strong> Destinations</span>
            <span><strong>4.9★</strong> Customer Rating</span>
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell about-story-grid">
          <div>
            <p className="eyebrow">OUR STORY</p>
            <h2 className="reference-title">Travel that feels personal.</h2>
            <p className="reference-copy">YATRA was built around a simple idea: help travellers experience India in comfort, safety and style. Reliable cars, thoughtful itineraries and transparent service sit at the heart of every journey.</p>
            <ButtonLink href="/custom-trip">Our Journey →</ButtonLink>
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
