import type { Metadata } from "next";
import { TravelGuideBrowser } from "@/components/travel-guide-browser";
import { getPublicBlogPosts } from "@/lib/public-blog";
import { JsonLd, appUrl, breadcrumbSchema } from "@/components/seo-json-ld";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "India Travel Guides: Temple & Road Trip Planning",
  description:
    "Read practical YATRA guides for Ujjain, Mahakaleshwar, Omkareshwar, Bhopal road trips, Maheshwar–Mandu and Varanasi spiritual travel.",
  alternates: { canonical: "/travel-guides" },
  openGraph: {
    title: "India Travel Guides: Temple & Road Trip Planning | YATRA",
    description:
      "Practical temple, destination and private road-trip planning guides across India.",
    url: "/travel-guides",
    images: [{ url: "/assets/home-hero.webp", alt: "YATRA India travel guides" }],
  },
};

export default async function TravelGuidesPage() {
  const stories = await getPublicBlogPosts();

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "YATRA India Travel Guides",
    itemListElement: stories.map((story, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: story.title,
      url: appUrl(`/travel-guides/${story.slug}`),
    })),
  };

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", path: "/" },
    { name: "Travel Guides", path: "/travel-guides" },
  ]);

  return (
    <>
      <JsonLd data={[itemList, breadcrumbs]} />
      <section className="story-hero story-hero--blog">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">TRAVEL STORIES</p>
          <h1>Journeys inspire<br />better humans.</h1>
          <p>Travel stories, destination guides, temple insights and road-trip ideas for more meaningful journeys.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <TravelGuideBrowser stories={stories} />
      </section>
    </>
  );
}
