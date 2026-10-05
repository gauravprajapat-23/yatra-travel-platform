import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Travel Stories & Guides",
  description: "Destination stories, temple guides and road-trip inspiration from YATRA.",
};

const stories = [
  { title: "Omkareshwar Travel Guide", category: "Destinations", assetClass: "asset-temple--omkareshwar" },
  { title: "Raipur to Ujjain by Car", category: "Road Trips", assetClass: "asset-temple--ujjain" },
  { title: "Rameswaram Travel Guide", category: "Destinations", assetClass: "asset-temple--rameswaram" },
  { title: "Best Time to Visit Kedarnath", category: "Temple Guide", assetClass: "asset-temple--kedarnath" },
  { title: "A Spiritual Journey Through Varanasi", category: "Culture", assetClass: "asset-destination--varanasi" },
  { title: "Rajasthan Road Trip", category: "Travel Tips", assetClass: "asset-vp--rajasthan" },
];

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
        <div className="shell reference-filter-row">
          {["All Stories","Destinations","Temple Guides","Travel Tips","Road Trips","Culture & Food"].map((item,i) => <button className={i===0?"filter-chip filter-chip--active":"filter-chip"} key={item}>{item}</button>)}
        </div>

        <div className="shell featured-story">
          <div
            className="featured-story__image asset-sprite asset-temple--ujjain"
            role="img"
            aria-label="Mahakaleshwar Ujjain temple travel guide"
          />
          <div className="featured-story__copy">
            <p className="eyebrow">TEMPLE GUIDE</p>
            <h2>A Complete Guide to Mahakaleshwar Ujjain.</h2>
            <p>History, darshan timings, nearby places and practical tips for a fulfilling spiritual journey.</p>
            <Link href="/travel-guides/spiritual-journey-varanasi">Read Full Story →</Link>
          </div>
        </div>

        <div className="shell story-grid">
          {stories.map((story) => (
            <article className="story-card" key={story.title}>
              <div
                className={`story-card__image asset-sprite ${story.assetClass}`}
                role="img"
                aria-label={story.title}
              />
              <div className="story-card__body">
                <p className="eyebrow">{story.category}</p>
                <h3>{story.title}</h3>
                <Link href="/travel-guides/spiritual-journey-varanasi">Read More →</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
