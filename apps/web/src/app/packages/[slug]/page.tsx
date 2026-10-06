import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicPackageBySlug } from "@/lib/public-packages";

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
    title: pkg.title,
    description:
      pkg.summary ??
      `${pkg.durationDays}-day chauffeur-driven YATRA tour package.`,
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

  return (
    <>
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
