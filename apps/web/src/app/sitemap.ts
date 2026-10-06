import type { MetadataRoute } from "next";

const publicRoutes = [
  "",
  "/cars",
  "/cars/innova-crysta",
  "/packages",
  "/packages/kedarnath-badrinath",
  "/destinations",
  "/destinations/varanasi",
  "/temples/kedarnath",
  "/offers",
  "/travel-guides",
  "/travel-guides/spiritual-journey-varanasi",
  "/about",
  "/contact",
  "/faq",
  "/privacy-policy",
  "/terms",
  "/cancellation-policy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority:
      route === ""
        ? 1
        : route === "/cars" || route === "/packages" || route === "/destinations"
          ? 0.8
          : 0.7,
  }));
}
