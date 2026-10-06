"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PackageCard = {
  name: string;
  duration: string;
  price: string;
  category: "Temple" | "Heritage" | "Nature";
  destinations: string;
  assetClass: string;
  detailHref?: string;
};

const packages: PackageCard[] = [
  { name: "Spiritual Ujjain – Omkareshwar", duration: "3 Nights · 4 Days", price: "₹ 12,999", category: "Temple", destinations: "Ujjain Omkareshwar", assetClass: "asset-temple--ujjain" },
  { name: "Char Dham Yatra", duration: "8 Nights · 9 Days", price: "₹ 28,999", category: "Temple", destinations: "Kedarnath Badrinath Uttarakhand", assetClass: "asset-vp--char-dham", detailHref: "/packages/kedarnath-badrinath" },
  { name: "South India Temple Trail", duration: "5 Nights · 6 Days", price: "₹ 18,499", category: "Temple", destinations: "Rameswaram Tamil Nadu", assetClass: "asset-vp--south-india" },
  { name: "Rajasthan Heritage Explorer", duration: "6 Nights · 7 Days", price: "₹ 21,999", category: "Heritage", destinations: "Rajasthan Jaipur Udaipur", assetClass: "asset-vp--rajasthan" },
  { name: "Kerala Backwaters Escape", duration: "4 Nights · 5 Days", price: "₹ 16,999", category: "Nature", destinations: "Kerala Backwaters", assetClass: "asset-vp--kerala" },
  { name: "Varanasi Spiritual Journey", duration: "3 Nights · 4 Days", price: "₹ 11,499", category: "Temple", destinations: "Varanasi Kashi", assetClass: "asset-destination--varanasi" },
];

export function PackageBrowser(){
  const [draftQuery,setDraftQuery]=useState("");
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("All");

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return packages.filter(pkg=>{
      if(category!=="All" && pkg.category!==category) return false;
      if(!q) return true;
      return `${pkg.name} ${pkg.destinations} ${pkg.category}`.toLowerCase().includes(q);
    });
  },[query,category]);

  return (
    <>
      <section className="package-search-strip">
        <div className="shell package-search-strip__inner">
          <input value={draftQuery} onChange={e=>setDraftQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();setQuery(draftQuery.trim());}}} aria-label="Where do you want to go?" placeholder="Search destinations, e.g. Varanasi, Kerala..." />
          <select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Trip type">
            <option value="All">All trip types</option>
            <option value="Temple">Temple</option>
            <option value="Heritage">Heritage</option>
            <option value="Nature">Nature</option>
          </select>
          <button className="button-link button-link--primary" type="button" onClick={()=>setQuery(draftQuery.trim())}>Search Packages →</button>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          <div className="reference-section-heading">
            <p className="eyebrow">POPULAR TOUR PACKAGES</p>
            <h2 className="reference-title">Handpicked journeys for every kind of traveller.</h2>
          </div>

          {filtered.length ? (
            <div className="package-grid">
              {filtered.map(pkg=>(
                <article className="package-card" key={pkg.name}>
                  <div className={`package-card__image asset-sprite ${pkg.assetClass}`} role="img" aria-label={`${pkg.name} tour package`} />
                  <div className="package-card__body">
                    <h3>{pkg.name}</h3>
                    <p>{pkg.duration}</p>
                    <div className="package-card__footer">
                      <strong>{pkg.price} <small>/ person</small></strong>
                      {pkg.detailHref ? (
                        <Link className="button-link button-link--primary" href={pkg.detailHref}>View Details →</Link>
                      ) : (
                        <Link className="button-link button-link--primary" href="/custom-trip">Request This Trip →</Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <h2>No packages match your search.</h2>
              <p>Try another destination or trip type.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
