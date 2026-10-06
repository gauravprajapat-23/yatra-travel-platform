import type { Metadata } from "next";
import { PackageBrowser } from "@/components/package-browser";
import { getPublicPackages } from "@/lib/public-packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tour Packages",
  description: "Curated temple, heritage and road-trip packages across India.",
};

export default async function PackagesPage() {
  const packages = await getPublicPackages();

  return (
    <>
      <section className="reference-page-hero reference-page-hero--packages">
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">CURATED JOURNEYS</p>
          <h1>Curated journeys<br />across incredible India.</h1>
          <p>Published temple tours, heritage trails and road journeys managed by the YATRA team.</p>
        </div>
      </section>

      <PackageBrowser packages={packages} />
    </>
  );
}
