import type { Metadata } from "next";
import { FaqBrowser } from "@/components/faq-browser";
import { getPublicFaqs } from "@/lib/public-faqs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about YATRA bookings, pricing, vehicles and travel support.",
};

export default async function FaqPage() {
  const faqs = await getPublicFaqs();

  return (
    <>
      <section className="story-hero story-hero--faq">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">HELP CENTRE</p>
          <h1>Frequently Asked<br />Questions.</h1>
          <p>Published answers about booking, pricing, vehicles and travel support.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <FaqBrowser items={faqs} />
      </section>
    </>
  );
}
