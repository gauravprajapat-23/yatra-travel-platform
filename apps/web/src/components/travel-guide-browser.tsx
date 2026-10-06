"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PublicBlogCard } from "@/lib/public-blog";

export function TravelGuideBrowser({
  stories,
}: {
  stories: PublicBlogCard[];
}) {
  const categories = useMemo(
    () => [
      "All Stories",
      ...Array.from(new Set(stories.map((story) => story.category))).sort(),
    ],
    [stories],
  );
  const [category, setCategory] = useState("All Stories");

  const filteredStories = useMemo(
    () =>
      category === "All Stories"
        ? stories
        : stories.filter((story) => story.category === category),
    [category, stories],
  );

  return (
    <>
      <div className="shell reference-filter-row">
        {categories.map((item) => (
          <button
            type="button"
            className={
              category === item
                ? "filter-chip filter-chip--active"
                : "filter-chip"
            }
            onClick={() => setCategory(item)}
            key={item}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="shell story-grid story-grid--published">
        {filteredStories.length === 0 ? (
          <p>No published travel stories are available yet.</p>
        ) : (
          filteredStories.map((story) => (
            <article className="story-card" key={story.slug}>
              {story.heroUrl ? (
                <div
                  className="story-card__image"
                  role="img"
                  aria-label={story.title}
                  style={{
                    backgroundImage: `url("${story.heroUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : (
                <div
                  className={
                    story.heroClass
                      ? `story-card__image asset-sprite ${story.heroClass}`
                      : "story-card__image"
                  }
                  role="img"
                  aria-label={story.title}
                />
              )}
              <div className="story-card__body">
                <p className="eyebrow">{story.category}</p>
                <h3>{story.title}</h3>
                <p>{story.excerpt ?? "Read this YATRA travel story."}</p>
                <Link href={`/travel-guides/${story.slug}`}>Read More →</Link>
              </div>
            </article>
          ))
        )}
      </div>
    </>
  );
}
