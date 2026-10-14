export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: appUrl(item.path),
    })),
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "TravelAgency"],
    "@id": `${appUrl("/")}#organization`,
    name: "YATRA",
    url: appUrl("/"),
    logo: appUrl("/icon.svg"),
    description:
      "Chauffeur-driven road journeys, temple circuits and curated tours across India.",
    areaServed: {
      "@type": "Country",
      name: "India",
    },
    knowsAbout: [
      "Chauffeur-driven car travel in India",
      "Temple tours in India",
      "Jyotirlinga travel",
      "Madhya Pradesh road trips",
      "Custom tour planning",
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${appUrl("/")}#website`,
    name: "YATRA",
    url: appUrl("/"),
    description:
      "Plan chauffeur-driven cars, temple circuits and curated road journeys across India.",
    publisher: {
      "@id": `${appUrl("/")}#organization`,
    },
    inLanguage: "en-IN",
  };
}
