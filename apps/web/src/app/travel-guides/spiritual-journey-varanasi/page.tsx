import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "A Spiritual Journey Through Varanasi",
  description: "A YATRA guide to the temples, traditions and timeless experiences of Varanasi.",
};

export default function ArticlePage() {
  return (
    <>
      <section className="article-hero">
        <div className="article-hero__overlay" />
        <div className="shell article-hero__content">
          <p className="eyebrow">TRAVEL GUIDE</p>
          <h1>A Spiritual Journey<br />Through Varanasi.</h1>
          <p>Temples, traditions and timeless experiences on the banks of the Ganges.</p>
          <div className="article-meta"><span>By Ananya Sharma</span><span>12 Oct 2024</span><span>8 min read</span></div>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell article-layout">
          <aside className="article-toc">
            <strong>Table of Contents</strong>
            {["Introduction","Best Time to Visit","Top Experiences","Temples & Ghats","Local Food & Culture","Travel Tips","Suggested Tours"].map((x,i)=><a href={`#section-${i}`} key={x}>{i+1}. {x}</a>)}
            <div className="article-promo"><strong>Plan Your Varanasi Tour</strong><p>Customisable car tours with expert drivers.</p><Link href="/custom-trip">Explore Tours →</Link></div>
          </aside>

          <article className="article-content">
            <section id="section-0"><h2>1. Introduction</h2><p>Varanasi is more than a destination — it is an emotion. Ancient lanes, ghats, temple bells and the evening Ganga Aarti create an experience unlike anywhere else.</p><div className="article-image" /></section>
            <section id="section-1"><h2>2. Best Time to Visit</h2><p>October to March offers pleasant weather for temple visits, boat rides and long walks through the old city.</p></section>
            <section id="section-2"><h2>3. Top Experiences</h2><p>Begin before sunrise on the river, explore Kashi Vishwanath, walk the historic ghats and experience Ganga Aarti at dusk.</p></section>
          </article>
        </div>

        <div className="shell related-stories">
          <h2>Related Articles</h2>
          <div className="story-grid story-grid--three">
            {["10 Must-Visit Temples in India","A Complete Rajasthan Road Trip","The Colors and Culture of Udaipur"].map((x,i)=><article className="story-card" key={x}><div className={`story-card__image story-card__image--${i+1}`} /><div className="story-card__body"><h3>{x}</h3><span>6 min read</span></div></article>)}
          </div>
        </div>
      </section>
    </>
  );
}
