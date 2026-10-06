import type { MetadataRoute } from "next";
import { getPublicDestinations } from "@/lib/public-destinations";
import { getPublicPackages } from "@/lib/public-packages";
import { travelGuides } from "@/lib/travel-guides";

export const dynamic = "force-dynamic";

const staticRoutes = [
  "",
  "/cars",
  "/packages",
  "/destinations",
  "/offers",
  "/travel-guides",
  "/about",
  "/contact",
  "/faq",
  "/privacy-policy",
  "/terms",
  "/cancellation-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [packages, destinations] = await Promise.all([
    getPublicPackages(),
    getPublicDestinations(),
  ]);

  const routes = new Set<string>(staticRoutes);

  for (const pkg of packages) routes.add(`/packages/${pkg.slug}`);
  for (const destination of destinations) {
    routes.add(`/destinations/${destination.slug}`);
  }
  for (const guide of travelGuides) {
    routes.add(`/travel-guides/${guide.slug}`);
  }

  return [...routes].map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority:
      route === ""
        ? 1
        : route === "/cars" ||
            route === "/packages" ||
            route === "/destinations"
          ? 0.8
          : 0.7,
  }));
}
