import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredContentRenderer } from "@/components/structured-content-renderer";
import { PackageDepartureQuoteForm } from "@/components/package-departure-quote-form";
import { getPublicPackageBySlug } from "@/lib/public-packages";
import { JsonLd, appUrl, breadcrumbSchema } from "@/components/seo-json-ld";

export const dynamic = "force-dynamic";

function money(minor: string, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPublicPackageBySlug(slug);
  if (!pkg) return {};

  return {
    title: pkg.seoTitle ?? pkg.title,
    description:
      pkg.seoDescription ??
      pkg.summary ??
      `${pkg.durationDays}-day chauffeur-driven YATRA tour package.`,
    alternates: {
      canonical: pkg.canonicalUrl ?? `/packages/${pkg.slug}`,
    },
    openGraph: {
      type: "website",
      title: pkg.seoTitle ?? pkg.title,
      description:
        pkg.seoDescription ??
        pkg.summary ??
        `${pkg.durationDays}-day chauffeur-driven YATRA tour package.`,
      url: `/packages/${pkg.slug}`,
      images: pkg.heroUrl
        ? [{ url: pkg.heroUrl, alt: pkg.title }]
        : [{ url: "/assets/packages-hero.webp", alt: pkg.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: pkg.seoTitle ?? pkg.title,
      description:
        pkg.seoDescription ??
        pkg.summary ??
        `${pkg.durationDays}-day chauffeur-driven YATRA tour package.`,
      images: [pkg.heroUrl ?? "/assets/packages-hero.webp"],
    },
    robots: {
      index: pkg.robotsIndex,
      follow: pkg.robotsFollow,
    },
  };
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pkg = await getPublicPackageBySlug(slug);

  if (!pkg) notFound();

  const packageSchema = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    "@id": `${appUrl(`/packages/${pkg.slug}`)}#trip`,
    name: pkg.title,
    description: pkg.summary ?? undefined,
    url: appUrl(`/packages/${pkg.slug}`),
    image: pkg.heroUrl ? [pkg.heroUrl] : [appUrl("/assets/packages-hero.webp")],
    touristType: ["Pilgrims", "Families", "Private travellers"],
    itinerary: pkg.destinations.map((destination) => ({
      "@type": "TouristDestination",
      name: destination.name,
      url: appUrl(`/destinations/${destination.slug}`),
    })),
    offers: pkg.priceOptions.slice(0, 6).map((option) => ({
      "@type": "Offer",
      priceCurrency: option.currency,
      price: (Number(option.amountMinor) / 100).toFixed(0),
      availability: pkg.departures.length
        ? "https://schema.org/InStock"
        : "https://schema.org/LimitedAvailability",
      url: appUrl(`/packages/${pkg.slug}`),
    })),
    provider: {
      "@id": `${appUrl("/")}#organization`,
    },
  };

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Tour Packages", path: "/packages" },
    { name: pkg.title, path: `/packages/${pkg.slug}` },
  ]);

  return (
    <>
      <JsonLd data={[packageSchema, breadcrumbs]} />
      <section
        className="reference-page-hero reference-page-hero--packages package-detail-live-hero"
        style={{
          backgroundImage: `url("${pkg.heroUrl || "/assets/temple-hero.webp"}")`,
        }}
      >
        <div className="reference-page-hero__overlay" />
        <div className="shell reference-page-hero__content">
          <p className="eyebrow">PUBLISHED JOURNEY</p>
          <h1>{pkg.title}</h1>
          <p>{pkg.summary ?? "A curated YATRA journey."}</p>
          <div className="reference-hero-badges">
            <span>{pkg.durationNights} Nights</span>
            <span>{pkg.durationDays} Days</span>
            {pkg.destinations.slice(0, 3).map((destination) => (
              <span key={destination.slug}>{destination.name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell package-detail-live-grid">
          <article>
            <p className="eyebrow">ITINERARY</p>
            <h2 className="reference-title reference-title--small">
              Your journey, day by day.
            </h2>

            <StructuredContentRenderer body={pkg.body} />

            {pkg.itinerary.length ? (
              <div className="package-itinerary-list">
                {pkg.itinerary.map((day) => (
                  <div className="package-itinerary-day" key={day.dayNumber}>
                    <strong>Day {day.dayNumber}</strong>
                    <h3>{day.title}</h3>
                    {day.description ? <p>{day.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p>The detailed itinerary will be confirmed before booking.</p>
            )}
          </article>

          <aside className="booking-card package-detail-quote-card">
            <h2>Price Options</h2>
            {pkg.priceOptions.length ? (
              pkg.priceOptions.map((option) => (
                <div className="package-price-option" key={option.id}>
                  <strong>{money(option.amountMinor, option.currency)}</strong>
                  <span>{option.mode.replaceAll("_", " ").toLowerCase()}</span>
                  {option.vehicleClass ? <small>{option.vehicleClass}</small> : null}
                  {option.minTravellers || option.maxTravellers ? (
                    <small>
                      {option.minTravellers ?? 1}–{option.maxTravellers ?? "∞"} travellers
                    </small>
                  ) : null}
                </div>
              ))
            ) : (
              <p>Price is available by custom quote.</p>
            )}

            <PackageDepartureQuoteForm
              packageSlug={pkg.slug}
              priceOptions={pkg.priceOptions}
              departures={pkg.departures}
              bookingEnabled={process.env.PACKAGE_BOOKING_WRITE_ENABLED === "true"}
              promotionsEnabled={process.env.PROMOTION_APPLY_ENABLED === "true"}
            />

            <Link
              className="button-link button-link--primary"
              href={`/custom-trip?package=${encodeURIComponent(pkg.slug)}`}
            >
              Request This Journey →
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
