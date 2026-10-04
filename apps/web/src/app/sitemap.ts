import type { MetadataRoute } from "next";

const publicRoutes = [
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

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return publicRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
