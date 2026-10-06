import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredContentRenderer } from "@/components/structured-content-renderer";
import { getPublicDestinationBySlug } from "@/lib/public-destinations";

export const dynamic = "force-dynamic";

function factLines(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => factLines(item)).slice(0, 30);
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([key, entry]) => {
        const values = factLines(entry);
        return values.map(
          (item) =>
            `${key.replaceAll("_", " ")}: ${item}`,
        );
      })
      .slice(0, 30);
  }

  return [];
}

function FactList({ value }: { value: unknown }) {
  const lines = factLines(value);
  if (lines.length === 0) return null;

  return (
    <ul>
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}>{line}</li>
      ))}
    </ul>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const destination = await getPublicDestinationBySlug(slug);
  if (!destination) return {};

  return {
    title: destination.seoTitle ?? destination.name,
    description:
      destination.seoDescription ??
      destination.summary ??
      `Plan a chauffeur-driven journey to ${destination.name} with YATRA.`,
    alternates: destination.canonicalUrl
      ? { canonical: destination.canonicalUrl }
      : undefined,
    robots: {
      index: destination.robotsIndex,
      follow: destination.robotsFollow,
    },
  };
}

export default async function DestinationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const destination = await getPublicDestinationBySlug(slug);

  if (!destination) notFound();

  const temple = destination.templeProfile;

  return (
    <>
      <section
        className="destination-detail-hero destination-detail-hero--live"
        style={{
          backgroundImage: `url("${destination.heroUrl || "/assets/temple-hero.webp"}")`,
        }}
      >
        <div className="destination-detail-hero__overlay"/>
        <div className="shell destination-detail-hero__content">
          <p>Home · Destinations · {destination.name}</p>
          <h1>{destination.name}</h1>
          <h2>{destination.kind.replaceAll("_", " ")}</h2>
          <p>{destination.summary ?? "A published YATRA destination."}</p>
          <div className="reference-hero-badges">
            <span>{destination.kind.replaceAll("_", " ")}</span>
            {destination.isFeatured ? <span>Featured Destination</span> : null}
            {temple?.deity ? <span>{temple.deity}</span> : null}
          </div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell destination-detail-grid">
          <article>
            <h2>About {destination.name}</h2>
            <p>
              {destination.summary ??
                "Our travel team can help build a private journey around this destination."}
            </p>

            <StructuredContentRenderer body={destination.body} />

            {temple ? (
              <>
                <h2>{temple.templeName}</h2>
                {temple.darshanNotes ? <p>{temple.darshanNotes}</p> : null}

                <div className="destination-fact-grid">
                  {temple.dressCode ? (
                    <span><strong>Dress Code</strong>{temple.dressCode}</span>
                  ) : null}
                  {factLines(temple.openingHours).length ? (
                    <span>
                      <strong>Opening Hours</strong>
                      <FactList value={temple.openingHours} />
                    </span>
                  ) : null}
                  {factLines(temple.practicalNotes).length ? (
                    <span>
                      <strong>Practical Notes</strong>
                      <FactList value={temple.practicalNotes} />
                    </span>
                  ) : null}
                </div>

                {factLines(temple.nearbyPlaces).length ? (
                  <>
                    <h3>Nearby Places</h3>
                    <FactList value={temple.nearbyPlaces} />
                  </>
                ) : null}
              </>
            ) : null}
          </article>

          <aside>
            <div className="plan-card">
              <h3>Plan Your {destination.name} Trip</h3>
              <p>Submit your dates, travellers and vehicle preference for a personalised itinerary.</p>
              <Link
                className="button-link button-link--primary"
                href={`/custom-trip?destination=${encodeURIComponent(destination.slug)}`}
              >
                Plan a Custom Trip →
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
