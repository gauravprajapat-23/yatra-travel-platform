import { getDb } from "@yatra/db/client";

export type PublicCmsPage = {
  slug: string;
  title: string;
  excerpt: string | null;
  body: unknown;
  heroUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  publishedAt: Date;
};

export async function getPublicCmsPageBySlug(
  slug: string,
): Promise<PublicCmsPage | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = getDb();
    const now = new Date();

    const row = await db.cmsPage.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        body: true,
        publishedAt: true,
        seoTitle: true,
        seoDescription: true,
        canonicalUrl: true,
        robotsIndex: true,
        robotsFollow: true,
        heroMedia: { select: { publicUrl: true } },
      },
    });

    if (!row || !row.publishedAt) return null;

    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      heroUrl: row.heroMedia?.publicUrl ?? null,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      canonicalUrl: row.canonicalUrl,
      robotsIndex: row.robotsIndex,
      robotsFollow: row.robotsFollow,
      publishedAt: row.publishedAt,
    };
  } catch (error) {
    console.error(
      "[public-cms] Unable to load CMS page:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return null;
  }
}


export async function getPublicCmsPages(): Promise<
  Array<{ slug: string; robotsIndex: boolean }>
> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const now = new Date();

    const rows = await db.cmsPage.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        slug: true,
        robotsIndex: true,
      },
      orderBy: { slug: "asc" },
    });

    return rows
      .filter(
        (row) =>
          Boolean(row.slug) &&
          row.slug !== "/" &&
          !row.slug.includes("/"),
      )
      .map((row) => ({
        slug: row.slug.replace(/^\/+|\/+$/g, ""),
        robotsIndex: row.robotsIndex,
      }));
  } catch (error) {
    console.error(
      "[public-cms] Unable to list CMS pages:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return [];
  }
}
