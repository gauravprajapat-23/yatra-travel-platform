import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredContentRenderer } from "@/components/structured-content-renderer";
import { getPublicBlogPostBySlug } from "@/lib/public-blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getPublicBlogPostBySlug(slug);
  if (!guide) return {};

  return {
    title: guide.seoTitle ?? guide.title,
    description:
      guide.seoDescription ??
      guide.excerpt ??
      `Read ${guide.title} from YATRA.`,
    alternates: guide.canonicalUrl
      ? { canonical: guide.canonicalUrl }
      : undefined,
    robots: {
      index: guide.robotsIndex,
      follow: guide.robotsFollow,
    },
  };
}

export default async function TravelGuideArticle({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = await getPublicBlogPostBySlug(slug);
  if (!guide) notFound();

  return (
    <>
      <section
        className={
          guide.heroUrl
            ? "article-hero article-hero--live"
            : guide.heroClass
              ? `article-hero asset-sprite ${guide.heroClass}`
              : "article-hero"
        }
        style={
          guide.heroUrl
            ? {
                backgroundImage: `url("${guide.heroUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="article-hero__overlay"/>
        <div className="shell article-hero__content">
          <p className="eyebrow">{guide.category}</p>
          <h1>{guide.title}</h1>
          <p>{guide.excerpt ?? "A YATRA travel story."}</p>
        </div>
      </section>

      <article className="reference-section reference-section--cream">
        <div className="shell article-content">
          <StructuredContentRenderer body={guide.body} />
          <div className="article-cta">
            <h2>Want help planning this journey?</h2>
            <Link className="button-link button-link--primary" href="/custom-trip">
              Plan a Custom Trip →
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
