import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
export const metadata: Metadata = { title: "Kedarnath – Badrinath Yatra" };

export default function PackageDetailPage(){
  return (
    <>
      <section className="package-detail-hero">
        <div className="package-detail-hero__image"/>
        <div className="shell package-detail-title"><span className="reference-badge">Pilgrimage</span><h1>Kedarnath – Badrinath Yatra</h1><p>A sacred journey to the abode of Lord Shiva and Lord Vishnu through the majestic Himalayas.</p></div>
      </section>
      <section className="reference-section reference-section--cream">
        <div className="shell package-detail-layout">
          <article>
            <div className="package-facts"><span>5 Nights</span><span>Haridwar → Kedarnath → Badrinath</span><span>Private Cab</span><span>Meals Included</span></div>
            <h2>Trip Itinerary</h2>
            {["Haridwar Arrival","Haridwar → Guptkashi","Guptkashi → Kedarnath","Kedarnath → Badrinath","Badrinath → Rudraprayag","Rudraprayag → Haridwar"].map((x,i)=><div className="itinerary-day" key={x}><span>Day {i+1}</span><div><strong>{x}</strong><p>Curated route, comfortable travel and time for darshan and local experiences.</p></div></div>)}
          </article>
          <aside className="package-book-box"><strong className="package-book-box__price">₹28,999 <small>/ person</small></strong><p>for 6 Days · Ex-Haridwar</p><label>Select Travellers<select><option>2 Adults</option><option>4 Adults</option></select></label><ButtonLink href="/checkout">Book This Package →</ButtonLink><ul><li>Verified & experienced drivers</li><li>Comfortable stays</li><li>Customisable itineraries</li><li>24×7 support</li></ul></aside>
        </div>
      </section>
    </>
  );
}
