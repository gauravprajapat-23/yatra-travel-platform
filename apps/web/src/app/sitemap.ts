import type { MetadataRoute } from "next";
import { getPublicBlogPosts } from "@/lib/public-blog";
import { getPublicCmsPages } from "@/lib/public-cms";
import { getPublicDestinations } from "@/lib/public-destinations";
import { getPublicFleet } from "@/lib/public-fleet";
import { getPublicPackages } from "@/lib/public-packages";

export const dynamic = "force-dynamic";

const staticRoutes = [
  "",
  "/cars",
  "/packages",
  "/destinations",
  "/offers",
  "/travel-guides",
  "/contact",
  "/faq",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");

  const [packages, destinations, blogPosts, vehicles, cmsPages] =
    await Promise.all([
      getPublicPackages(),
      getPublicDestinations(),
      getPublicBlogPosts(),
      getPublicFleet(),
      getPublicCmsPages(),
    ]);

  const routes = new Set<string>(staticRoutes);

  const hasCmsAbout = cmsPages.some((page) => page.slug === "about");
  if (!hasCmsAbout) {
    routes.add("/about");
  }

  for (const page of cmsPages) {
    if (page.robotsIndex) {
      routes.add(`/${page.slug}`);
    }
  }

  for (const pkg of packages) {
    if (pkg.robotsIndex) {
      routes.add(`/packages/${pkg.slug}`);
    }
  }

  for (const destination of destinations) {
    if (destination.robotsIndex) {
      routes.add(`/destinations/${destination.slug}`);
    }
  }

  for (const post of blogPosts) {
    if (post.robotsIndex) {
      routes.add(`/travel-guides/${post.slug}`);
    }
  }

  for (const vehicle of vehicles) {
    routes.add(`/cars/${vehicle.slug}`);
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
