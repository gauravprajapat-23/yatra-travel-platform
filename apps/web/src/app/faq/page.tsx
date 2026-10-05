import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about YATRA bookings, pricing, vehicles and travel support.",
};

const groups = [
  ["Booking & Reservations",["How do I book a car or tour with YATRA?","Can I customise my itinerary?","Do you offer airport pickup and drop?","How far in advance should I book?"]],
  ["Pricing & Payments",["What is included in the price?","Do I need to pay a booking advance?","What payment methods do you accept?","Are there any hidden charges?"]],
];

export default function FaqPage() {
  return (
    <>
      <section className="story-hero story-hero--faq">
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">HELP CENTRE</p>
          <h1>Frequently Asked<br />Questions.</h1>
          <p>Everything you need to know before booking, travelling and exploring India with YATRA.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell faq-search"><input placeholder="Search questions (e.g. cancellation, payment, vehicle)..." /></div>
        <div className="shell faq-layout">
          <aside className="faq-categories">
            <strong>Categories</strong>
            {["All Questions","Booking & Reservations","Pricing & Payments","Cancellations & Refunds","Travel Policies","Vehicles & Drivers","Tours & Destinations","Safety & Support"].map((item,i) => <button className={i===0 ? "faq-category faq-category--active":"faq-category"} key={item}>{item}</button>)}
          </aside>
          <div className="faq-content">
            {groups.map(([title,questions]) => (
              <section className="faq-group" key={title as string}>
                <h2>{title as string}</h2>
                {(questions as string[]).map((q,i) => (
                  <details className="faq-item" key={q} open={i===0}>
                    <summary>{q}</summary>
                    <p>Our travel team confirms the route, inclusions, timings and any applicable policy details before final booking.</p>
                  </details>
                ))}
              </section>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
