import type { Metadata } from "next";
import { CustomTripBuilder } from "@/components/custom-trip-builder";

export const metadata: Metadata = {
  title: "Custom Trip Builder",
  description: "Build a custom chauffeur-driven journey with YATRA.",
  robots: { index: false, follow: false },
};

export default function CustomTripPage() {
  return (
    <>
      <section className="reference-page-hero reference-page-hero--custom">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">PLAN YOUR OWN JOURNEY</p>
          <h1>Custom Trip Builder.</h1>
          <p>Tell us your route plans and we&apos;ll create the perfect itinerary with the right car, route and experience.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <CustomTripBuilder />
      </section>
    </>
  );
}
