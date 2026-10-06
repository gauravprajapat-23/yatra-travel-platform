import type { Metadata } from "next";
import { FaqBrowser } from "@/components/faq-browser";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about YATRA bookings, pricing, vehicles and travel support.",
};

export default function FaqPage() {
  return (
    <>
      <section className="story-hero story-hero--faq">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">HELP CENTRE</p>
          <h1>Frequently Asked<br />Questions.</h1>
          <p>Everything you need to know before booking, travelling and exploring India with YATRA.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <FaqBrowser />
      </section>
    </>
  );
}
