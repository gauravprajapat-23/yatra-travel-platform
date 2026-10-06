import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact YATRA",
  description: "Talk to YATRA about bookings, custom trips and travel support.",
};

export default function ContactPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();

  return (
    <>
      <section className="story-hero story-hero--contact">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">CONTACT YATRA</p>
          <h1>Get in touch.</h1>
          <p>Plan your perfect journey, ask about a booking or speak with the travel team.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell contact-channels">
          <article className="contact-channel">
            <strong>Travel Enquiry</strong>
            <span>Use the secure form below</span>
          </article>
          <article className="contact-channel">
            <strong>Existing Booking</strong>
            <span>Include your booking reference</span>
          </article>
          {supportEmail ? (
            <article className="contact-channel">
              <strong>Email</strong>
              <span>{supportEmail}</span>
            </article>
          ) : null}
          <article className="contact-channel">
            <strong>Custom Trip</strong>
            <span>Create a personalised trip request</span>
          </article>
        </div>

        <div className="shell contact-layout">
          <ContactForm />

          <aside className="office-card">
            <p className="eyebrow">TRAVEL SUPPORT</p>
            <h2>YATRA Support</h2>
            <p>We serve travellers planning chauffeur-driven journeys and curated tours across India.</p>
            <dl>
              <div><dt>Booking support</dt><dd>Use your booking reference when contacting us</dd></div>
              <div><dt>Custom trips</dt><dd>Submit your route and preferences through the trip builder</dd></div>
            </dl>
            <div className="office-map asset-sprite asset-destination--jaipur">Journeys across India</div>
          </aside>
        </div>
      </section>

      <section className="reference-journey-cta reference-journey-cta--compact">
        <div className="shell reference-journey-cta__inner">
          <div className="reference-journey-cta__panel">
            <h2>Ready to plan your next journey?</h2>
            <p>Send your route, dates and traveller details for a personalised itinerary.</p>
            <ButtonLink href="/custom-trip">Plan a Trip Now →</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
