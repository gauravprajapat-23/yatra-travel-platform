import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/button-link";
import { getPublicFleetVehicleBySlug } from "@/lib/public-fleet";

export const dynamic = "force-dynamic";

function featureLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    );
  }

  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key.replaceAll("_", " "));
  }

  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getPublicFleetVehicleBySlug(slug);
  if (!vehicle) return {};

  return {
    title: vehicle.displayName,
    description:
      vehicle.description ??
      `${vehicle.displayName} · ${vehicle.className} · ${vehicle.seats} seats. Request a server-verified YATRA quote.`,
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getPublicFleetVehicleBySlug(slug);
  if (!vehicle) notFound();

  const features = featureLabels(vehicle.features);
  const primary =
    vehicle.primaryImageUrl ?? "/assets/car-innova.webp";
  const gallery =
    vehicle.galleryUrls.length > 0
      ? vehicle.galleryUrls
      : [primary];

  return (
    <section className="reference-section reference-section--cream car-detail-reference">
      <div className="shell car-detail-top">
        <div className="car-detail-gallery">
          <div className="car-detail-gallery__main">
            {vehicle.isFeatured ? (
              <span className="vehicle-card-badge">Featured</span>
            ) : null}
            <img
              src={primary}
              alt={vehicle.displayName}
              loading="eager"
            />
          </div>

          <div className="car-detail-gallery__thumbs">
            {gallery.slice(0, 4).map((url, index) => (
              <img
                key={`${url}-${index}`}
                src={url}
                alt={`${vehicle.displayName} view ${index + 1}`}
                loading="lazy"
              />
            ))}
            {gallery.length > 4 ? (
              <div className="car-gallery-more">
                +{gallery.length - 4} Photos
              </div>
            ) : null}
          </div>
        </div>

        <div className="car-detail-summary">
          <div className="car-detail-heading-row">
            <div>
              <h1>{vehicle.displayName}</h1>
              <p>
                {vehicle.className} · {vehicle.seats} Seats
                {vehicle.luggage !== null
                  ? ` · ${vehicle.luggage} Bags`
                  : ""}
              </p>
            </div>
          </div>

          <div className="spec-icon-grid">
            <span>♙<b>{vehicle.seats} Seats</b></span>
            <span>▣<b>{vehicle.luggage ?? "—"} Bags</b></span>
            <span>❄<b>{vehicle.airConditioned ? "AC" : "Non-AC"}</b></span>
            <span>◈<b>{vehicle.className}</b></span>
          </div>

          <div className="car-price-panel">
            <strong>Server-verified quote</strong>
            <small>
              Final fare depends on route, dates, availability and active pricing rules.
            </small>
            <ButtonLink href="/booking/car">Book This Car →</ButtonLink>
          </div>
        </div>
      </div>

      <div className="shell car-detail-body">
        <article>
          <h2>Vehicle overview</h2>
          <p>
            {vehicle.description ??
              "This active YATRA fleet vehicle is available for server-reviewed chauffeur-driven journeys."}
          </p>

          {features.length > 0 ? (
            <div className="benefit-grid">
              {features.map((feature) => (
                <span key={feature}>◎ <b>{feature}</b></span>
              ))}
            </div>
          ) : null}
        </article>

        <aside>
          <h3>Plan a journey with this vehicle</h3>
          <p>
            Select your route and travel dates to receive a server-verified
            quote based on the current pricing rules and availability.
          </p>
          <ButtonLink href="/custom-trip">Request a Custom Trip →</ButtonLink>
        </aside>
      </div>
    </section>
  );
}
