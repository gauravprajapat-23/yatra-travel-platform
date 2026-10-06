"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { travelGuides } from "@/lib/travel-guides";

const categories=["All Stories","Destinations","Temple Guides","Travel Tips","Road Trips","Culture & Food"];

export function TravelGuideBrowser(){
  const [category,setCategory]=useState("All Stories");

  const stories=useMemo(
    ()=>category==="All Stories"?travelGuides:travelGuides.filter(story=>story.category===category),
    [category],
  );

  return (
    <>
      <div className="shell reference-filter-row">
        {categories.map(item=>(
          <button
            type="button"
            className={category===item?"filter-chip filter-chip--active":"filter-chip"}
            onClick={()=>setCategory(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="shell story-grid story-grid--published">
        {stories.map(story=>(
          <article className="story-card" key={story.slug}>
            <div className={`story-card__image asset-sprite ${story.heroClass}`} role="img" aria-label={story.title}/>
            <div className="story-card__body">
              <p className="eyebrow">{story.category}</p>
              <h3>{story.title}</h3>
              <p>{story.excerpt}</p>
              <Link href={`/travel-guides/${story.slug}`}>Read More →</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
