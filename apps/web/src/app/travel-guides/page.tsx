import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Travel Stories & Guides",
  description: "Destination stories, temple guides and road-trip inspiration from YATRA.",
};

const stories = [
  ["Omkareshwar Travel Guide","Destinations"],
  ["Raipur to Ujjain by Car","Road Trips"],
  ["Rameswaram Travel Guide","Destinations"],
  ["Best Time to Visit Kedarnath","Temple Guide"],
  ["A Spiritual Journey Through Varanasi","Culture"],
  ["Rajasthan Road Trip","Travel Tips"],
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
          <div className="featured-story__image" />
          <div className="featured-story__copy">
            <p className="eyebrow">TEMPLE GUIDE</p>
            <h2>A Complete Guide to Mahakaleshwar Ujjain.</h2>
            <p>History, darshan timings, nearby places and practical tips for a fulfilling spiritual journey.</p>
            <Link href="/travel-guides/spiritual-journey-varanasi">Read Full Story →</Link>
          </div>
        </div>

        <div className="shell story-grid">
          {stories.map(([title,cat],index) => (
            <article className="story-card" key={title}>
              <div className={`story-card__image story-card__image--${(index%3)+1}`} />
              <div className="story-card__body"><p className="eyebrow">{cat}</p><h3>{title}</h3><Link href="/travel-guides/spiritual-journey-varanasi">Read More →</Link></div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
