"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicPackageCard } from "@/lib/public-packages";

function formatPrice(pkg: PublicPackageCard): string {
  if (!pkg.price) return "Request quote";

  const amount = Number(pkg.price.amountMinor) / 100;
  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: pkg.price.currency,
    maximumFractionDigits: 0,
  }).format(amount);

  const suffix =
    pkg.price.mode === "PER_PERSON"
      ? " / person"
      : pkg.price.mode === "PER_VEHICLE"
        ? " / vehicle"
        : pkg.price.mode === "PER_GROUP"
          ? " / group"
          : "";

  return `${money}${suffix}`;
}

export function PackageBrowser({ packages }: { packages: PublicPackageCard[] }) {
  const [draftQuery,setDraftQuery]=useState("");
  const [query,setQuery]=useState("");

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q) return packages;
    return packages.filter(pkg=>
      `${pkg.title} ${pkg.summary ?? ""}`.toLowerCase().includes(q),
    );
  },[query,packages]);

  return (
    <>
      <section className="package-search-strip">
        <div className="shell package-search-strip__inner">
          <input
            value={draftQuery}
            onChange={e=>setDraftQuery(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter"){
                e.preventDefault();
                setQuery(draftQuery.trim());
              }
            }}
            aria-label="Search tour packages"
            placeholder="Search published tours..."
          />
          <button
            className="button-link button-link--primary"
            type="button"
            onClick={()=>setQuery(draftQuery.trim())}
          >
            Search Packages →
          </button>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <div className="shell">
          <div className="reference-section-heading">
            <p className="eyebrow">PUBLISHED TOUR PACKAGES</p>
            <h2 className="reference-title">Handpicked journeys for every kind of traveller.</h2>
          </div>

          {filtered.length ? (
            <div className="package-grid">
              {filtered.map(pkg=>(
                <article className="package-card" key={pkg.id}>
                  <div
                    className="package-card__image"
                    role="img"
                    aria-label={`${pkg.title} tour package`}
                    style={{
                      backgroundImage: `url("${pkg.heroUrl || "/assets/temple-hero.webp"}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="package-card__body">
                    <h3>{pkg.title}</h3>
                    <p>{pkg.durationNights} Nights · {pkg.durationDays} Days</p>
                    {pkg.summary ? <p>{pkg.summary}</p> : null}
                    <div className="package-card__footer">
                      <strong>{formatPrice(pkg)}</strong>
                      <Link
                        className="button-link button-link--primary"
                        href={`/packages/${pkg.slug}`}
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="search-empty-state">
              <h2>No published packages match your search.</h2>
              <p>Try another search or submit a custom trip request.</p>
              <Link className="button-link button-link--primary" href="/custom-trip">
                Request a Custom Trip →
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
