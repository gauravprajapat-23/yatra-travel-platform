import { StructuredContentRenderer } from "@/components/structured-content-renderer";
import type { PublicCmsPage } from "@/lib/public-cms";

export function CmsPublicDocument({
  page,
  eyebrow = "LEGAL",
}: {
  page: PublicCmsPage;
  eyebrow?: string;
}) {
  return (
    <>
      <section
        className="story-hero"
        style={
          page.heroUrl
            ? {
                backgroundImage: `url("${page.heroUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="story-hero__overlay" />
        <div className="shell story-hero__content">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{page.title}</h1>
          {page.excerpt ? <p>{page.excerpt}</p> : null}
        </div>
      </section>

      <article className="reference-section reference-section--cream">
        <div className="shell article-content">
          <StructuredContentRenderer body={page.body} />
          <p>
            <small>
              Published {page.publishedAt.toLocaleDateString("en-IN")}.
            </small>
          </p>
        </div>
      </article>
    </>
  );
}
