"use client";

import { useMemo, useState } from "react";

type FaqItem = {
  category: string;
  question: string;
  answer: string;
};

const items: FaqItem[] = [
  { category: "Booking & Reservations", question: "How do I book a car or tour with YATRA?", answer: "Choose a vehicle or tour, enter your trip details, review the server-verified quote, and continue through booking and payment when available." },
  { category: "Booking & Reservations", question: "Can I customise my itinerary?", answer: "Yes. Use the Custom Trip Builder and our team will review your route, dates, travellers and vehicle preferences." },
  { category: "Booking & Reservations", question: "Do you offer airport pickup and drop?", answer: "Airport transfers can be requested through the Custom Trip Builder or Contact form. Availability is confirmed before booking." },
  { category: "Booking & Reservations", question: "How far in advance should I book?", answer: "For normal road trips, booking a few days ahead is recommended. Temple seasons and peak holidays may require more advance planning." },
  { category: "Pricing & Payments", question: "What is included in the price?", answer: "The final quote clearly states the included fare components. Browser-displayed estimates are never the source of truth." },
  { category: "Pricing & Payments", question: "Do I need to pay a booking advance?", answer: "Payment requirements depend on the server booking state and current policy. The checkout page only enables payment when the booking is payable." },
  { category: "Pricing & Payments", question: "What payment methods do you accept?", answer: "Online payments are processed through Razorpay when enabled. Other payment arrangements may be confirmed by the YATRA team." },
  { category: "Pricing & Payments", question: "Are there any hidden charges?", answer: "No hidden charges should be added outside the confirmed quote and booking policy. Any route-specific extras must be disclosed before confirmation." },
  { category: "Cancellations & Refunds", question: "How do cancellations work?", answer: "Cancellation eligibility and refund rules follow the policy snapshot attached to your booking." },
  { category: "Vehicles & Drivers", question: "Are drivers verified?", answer: "YATRA only exposes active vehicle classes publicly and manages driver qualification and availability on the server side." },
  { category: "Safety & Support", question: "How do I get help during a trip?", answer: "Use the Contact page with your booking reference. Active journeys are supported by the YATRA operations team." },
];

const categories = [
  "All Questions",
  "Booking & Reservations",
  "Pricing & Payments",
  "Cancellations & Refunds",
  "Vehicles & Drivers",
  "Safety & Support",
];

export function FaqBrowser() {
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("All Questions");

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(item=>{
      if(category!=="All Questions" && item.category!==category) return false;
      if(!q) return true;
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
  },[query,category]);

  const grouped=useMemo(()=>{
    const map=new Map<string,FaqItem[]>();
    for(const item of filtered){
      const group=map.get(item.category)??[];
      group.push(item);
      map.set(item.category,group);
    }
    return [...map.entries()];
  },[filtered]);

  return (
    <>
      <div className="shell faq-search">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search questions (e.g. cancellation, payment, vehicle)..." aria-label="Search FAQ" />
      </div>
      <div className="shell faq-layout">
        <aside className="faq-categories">
          <strong>Categories</strong>
          {categories.map(item=>(
            <button
              type="button"
              className={category===item?"faq-category faq-category--active":"faq-category"}
              onClick={()=>setCategory(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </aside>

        <div className="faq-content">
          {grouped.length ? grouped.map(([title,questions])=>(
            <section className="faq-group" key={title}>
              <h2>{title}</h2>
              {questions.map((item,i)=>(
                <details className="faq-item" key={item.question} open={i===0}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          )) : (
            <div className="faq-empty">
              <h2>No matching questions</h2>
              <p>Try another keyword or choose All Questions.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
