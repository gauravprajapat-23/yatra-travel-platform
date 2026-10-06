import type { Metadata } from "next";
import { PackageBrowser } from "@/components/package-browser";

export const metadata: Metadata = {
  title: "Tour Packages",
  description: "Curated temple, heritage and road-trip packages across India.",
};

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

      <PackageBrowser />
    </>
  );
}
