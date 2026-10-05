import type { Metadata } from "next";
import { ButtonLink } from "@/components/button-link";
export const metadata: Metadata = { title: "Varanasi — The Eternal City" };

export default function VaranasiPage(){
  return (
    <>
      <section className="destination-detail-hero"><div className="destination-detail-hero__overlay"/><div className="shell destination-detail-hero__content"><p>Home · Destinations · Varanasi</p><h1>Varanasi</h1><h2>The Eternal City.</h2><p>A timeless blend of spirituality, culture and centuries-old traditions on the banks of the holy Ganges.</p><div className="reference-hero-badges"><span>Temples</span><span>Culture</span><span>Heritage</span><span>Spirituality</span></div></div></section>
      <section className="reference-section reference-section--cream">
        <div className="shell destination-detail-grid">
          <article><h2>About Varanasi</h2><p>One of the world&apos;s oldest living cities, Varanasi is a spiritual and cultural heartland of India. From Kashi Vishwanath to sunrise boat rides, the city offers a profound experience.</p><h2>Top Attractions</h2><div className="attraction-grid">{["Kashi Vishwanath Temple","Dashashwamedh Ghat","Sarnath","Assi Ghat"].map((x,i)=><div className={`attraction-card attraction-card--${i+1}`} key={x}><span>{x}</span></div>)}</div></article>
          <aside><div className="destination-fact-grid"><span><strong>State</strong>Uttar Pradesh</span><span><strong>Best For</strong>Spiritual & Cultural Travel</span><span><strong>Ideal Duration</strong>2–4 Days</span></div><div className="plan-card"><h3>Plan Your Varanasi Trip</h3><p>Choose from curated packages or create a custom itinerary.</p><ButtonLink href="/custom-trip">Explore Packages →</ButtonLink></div></aside>
        </div>
      </section>
    </>
  );
}
