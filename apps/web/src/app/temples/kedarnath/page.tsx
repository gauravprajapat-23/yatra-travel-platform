import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";

export const metadata: Metadata = { title: "Kedarnath Dham" };

const itineraries = [
  { name: "Kedarnath Yatra", nights: 4, days: 5, price: 28500, assetClass: "asset-temple--kedarnath" },
  { name: "Char Dham Yatra", nights: 5, days: 6, price: 54000, assetClass: "asset-vp--char-dham" },
  { name: "Kedarnath with Badrinath", nights: 6, days: 7, price: 36000, assetClass: "asset-temple--badrinath" },
];

export default function KedarnathPage(){
  return (
    <>
      <section className="temple-detail-hero">
        <div className="temple-detail-hero__overlay"/>
        <div className="shell temple-detail-hero__content">
          <p className="eyebrow">CHAR DHAM</p>
          <h1>Kedarnath<br/>Dham.</h1>
          <p>A divine journey to one of the holiest Jyotirlingas, nestled in the majestic Himalayas.</p>
          <div className="temple-facts"><span>3,583 m Altitude</span><span>May–Nov Darshan</span><span>Road / Trek Accessible</span><span>VIP Darshan Available</span></div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell temple-intro-grid">
          <article>
            <h2>Sacred Jyotirlinga in the Himalayas</h2>
            <p>Kedarnath Dham is one of the 12 Jyotirlingas of Lord Shiva and a key shrine in the Char Dham Yatra.</p>
            <ButtonLink href="/custom-trip">Plan Your Kedarnath Yatra →</ButtonLink>
          </article>
          <div className="temple-video-card asset-sprite asset-temple--kedarnath">
            <span>▶</span><strong>Watch Temple Video</strong><small>2:36 mins</small>
          </div>
        </div>

        <div className="shell">
          <h2 className="reference-title reference-title--small">Popular Itineraries to Kedarnath</h2>
          <div className="package-grid">
            {itineraries.map((trip) => (
              <article className="package-card" key={trip.name}>
                <div
                  className={`package-card__image asset-sprite ${trip.assetClass}`}
                  role="img"
                  aria-label={`${trip.name} itinerary`}
                />
                <div className="package-card__body">
                  <h3>{trip.name}</h3>
                  <p>{trip.nights} Nights · {trip.days} Days</p>
                  <strong>₹{trip.price.toLocaleString("en-IN")} <small>/ person</small></strong>
                  <ButtonLink href="/packages/kedarnath-badrinath">View Details →</ButtonLink>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
