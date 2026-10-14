import type { Metadata } from "next";
import { PackageBrowser } from "@/components/package-browser";
import { getPublicPackages } from "@/lib/public-packages";
import { JsonLd, appUrl, breadcrumbSchema } from "@/components/seo-json-ld";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "India Tour Packages: Temple, Heritage & Road Trips",
  description:
    "Explore curated India tour packages including Ujjain–Omkareshwar Jyotirlinga, Maheshwar–Mandu, Bhopal–Sanchi, Varanasi and Madhya Pradesh road journeys.",
  alternates: { canonical: "/packages" },
  openGraph: {
    title: "India Tour Packages: Temple, Heritage & Road Trips | YATRA",
    description:
      "Curated temple, heritage and chauffeur-driven road-trip packages across India.",
    url: "/packages",
    images: [{ url: "/assets/packages-hero.webp", alt: "YATRA India tour packages" }],
  },
};

export default async function PackagesPage() {
  const packages = await getPublicPackages();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "YATRA India Tour Packages",
    itemListElement: packages.map((pkg, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: pkg.title,
      url: appUrl(`/packages/${pkg.slug}`),
    })),
  };

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Tour Packages", path: "/packages" },
  ]);

  return (
    <>
      <JsonLd data={[itemList, breadcrumbs]} />
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
