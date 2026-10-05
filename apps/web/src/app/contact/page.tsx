import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = {
  title: "Contact YATRA",
  description: "Talk to YATRA about bookings, custom trips and travel support.",
};

export default function ContactPage() {
  return (
    <>
      <section className="story-hero story-hero--contact">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">CONTACT YATRA</p>
          <h1>Get in touch.</h1>
          <p>Plan your perfect journey, ask about a booking or speak with a travel expert.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell contact-channels">
          {[
            ["Call Us","+91 98765 43210"],
            ["WhatsApp","+91 98765 43210"],
            ["Email Us","hello@yatra.com"],
            ["Plan a Trip","Get a personalised quote"],
          ].map(([title,value]) => (
            <article className="contact-channel" key={title}><strong>{title}</strong><span>{value}</span></article>
          ))}
        </div>

        <div className="shell contact-layout">
          <form className="contact-form">
            <p className="eyebrow">SEND US A MESSAGE</p>
            <h2>Tell us about your travel plans.</h2>
            <div className="form-grid">
              <label>Full Name<input placeholder="Your name" /></label>
              <label>Email Address<input type="email" placeholder="you@example.com" /></label>
              <label>Phone Number<input placeholder="+91" /></label>
              <label>Preferred Travel Date<input type="date" /></label>
            </div>
            <label>Your Message<textarea placeholder="Tell us about your travel plans..." /></label>
            <button className="button-link button-link--primary" type="button">Send Message →</button>
          </form>

          <aside className="office-card">
            <p className="eyebrow">OUR OFFICE</p>
            <h2>YATRA Head Office</h2>
            <p>123 Travel Street, City Lines<br />India</p>
            <dl>
              <div><dt>Hours</dt><dd>Mon–Sat · 9:00 AM–8:00 PM</dd></div>
              <div><dt>Support</dt><dd>24×7 for active journeys</dd></div>
            </dl>
            <div className="office-map">YATRA · India</div>
          </aside>
        </div>
      </section>

      <section className="reference-journey-cta reference-journey-cta--compact">
        <div className="shell reference-journey-cta__inner">
          <div className="reference-journey-cta__panel">
            <h2>Ready to plan your next journey?</h2>
            <p>Talk to our travel experts and get a customised itinerary.</p>
            <ButtonLink href="/custom-trip">Plan a Trip Now →</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
