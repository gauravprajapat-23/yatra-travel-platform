import type { Metadata } from "next";
import { FaqBrowser } from "@/components/faq-browser";
import { getPublicFaqs } from "@/lib/public-faqs";
import { JsonLd, appUrl, breadcrumbSchema } from "@/components/seo-json-ld";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tour & Travel FAQs",
  description:
    "Answers about YATRA chauffeur-driven cars, tour packages, pricing, bookings, cancellations and travel support in India.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Tour & Travel FAQs | YATRA",
    description:
      "Answers about chauffeur-driven cars, tour packages, pricing, bookings and travel support in India.",
    url: "/faq",
    images: [{ url: "/assets/home-hero.webp", alt: "YATRA travel FAQs" }],
  },
};

export default async function FaqPage() {
  const faqs = await getPublicFaqs();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "FAQ", path: "/faq" },
  ]);

  return (
    <>
      <JsonLd data={[faqSchema, breadcrumbs]} />
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
