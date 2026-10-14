import type { MetadataRoute } from "next";

const privatePaths = [
  "/admin/",
  "/api/",
  "/booking/",
  "/checkout",
  "/payment",
  "/my-trips",
  "/custom-trip",
  "/cars/search",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
  };
}
