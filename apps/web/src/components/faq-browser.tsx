"use client";

import { useMemo, useState } from "react";
import type { PublicFaq } from "@/lib/public-faqs";

const scopeLabels: Record<PublicFaq["scope"], string> = {
  GENERAL: "General",
  BOOKING: "Booking & Reservations",
  PRICING: "Pricing & Payments",
  CANCELLATION: "Cancellations & Refunds",
  VEHICLES: "Vehicles & Drivers",
  PACKAGES: "Tours & Packages",
};

export function FaqBrowser({ items }: { items: PublicFaq[] }) {
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("All Questions");

  const categories=useMemo(
    ()=>["All Questions",...Array.from(new Set(items.map(item=>scopeLabels[item.scope])))],
    [items],
  );

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(item=>{
      const label=scopeLabels[item.scope];
      if(category!=="All Questions" && label!==category) return false;
      if(!q) return true;
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
  },[items,query,category]);

  const grouped=useMemo(()=>{
    const map=new Map<string,PublicFaq[]>();
    for(const item of filtered){
      const label=scopeLabels[item.scope];
      const group=map.get(label)??[];
      group.push(item);
      map.set(label,group);
    }
    return [...map.entries()];
  },[filtered]);

  return (
    <>
      <div className="shell faq-search">
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Search questions (e.g. cancellation, payment, vehicle)..."
          aria-label="Search FAQ"
        />
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
                <details className="faq-item" key={item.id} open={i===0}>
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </section>
          )) : (
            <div className="faq-empty">
              <h2>{items.length ? "No matching questions" : "FAQs are being prepared"}</h2>
              <p>
                {items.length
                  ? "Try another keyword or choose All Questions."
                  : "Use the Contact page if you need help before published FAQs are available."}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
