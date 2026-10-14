import type { Metadata } from "next";
import { TravelGuideBrowser } from "@/components/travel-guide-browser";
import { getPublicBlogPosts } from "@/lib/public-blog";

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

  return (
    <>
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
