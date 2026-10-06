import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findTravelGuide, travelGuides } from "@/lib/travel-guides";

export function generateStaticParams() {
  return travelGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = findTravelGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.excerpt,
  };
}

export default async function TravelGuideArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findTravelGuide(slug);
  if (!guide) notFound();

  return (
    <>
      <section className={`article-hero asset-sprite ${guide.heroClass}`}>
        <div className="article-hero__overlay"/>
        <div className="shell article-hero__content">
          <p className="eyebrow">{guide.category}</p>
          <h1>{guide.title}</h1>
          <p>{guide.excerpt}</p>
        </div>
      </section>

      <article className="reference-section reference-section--cream">
        <div className="shell article-content">
          <p className="article-intro">{guide.intro}</p>
          {guide.sections.map(section=>(
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
          <div className="article-cta">
            <h2>Want help planning this journey?</h2>
            <Link className="button-link button-link--primary" href="/custom-trip">Plan a Custom Trip →</Link>
          </div>
        </div>
      </article>
    </>
  );
}
