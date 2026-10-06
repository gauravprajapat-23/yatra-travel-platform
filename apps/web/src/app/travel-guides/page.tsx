import type { Metadata } from "next";
import { TravelGuideBrowser } from "@/components/travel-guide-browser";

export const metadata: Metadata = {
  title: "Travel Stories & Guides",
  description: "Destination stories, temple guides and road-trip inspiration from YATRA.",
};

export default function TravelGuidesPage() {
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
        <TravelGuideBrowser />
      </section>
    </>
  );
}
