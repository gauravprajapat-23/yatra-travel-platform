import { getDb } from "@yatra/db/client";
import { travelGuides } from "@/lib/travel-guides";

export type PublicBlogCard = {
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  heroUrl: string | null;
  heroClass: string | null;
  publishedAt: Date | null;
  robotsIndex: boolean;
};

export type PublicBlogDetail = PublicBlogCard & {
  body: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robotsFollow: boolean;
};

function legacyBody(
  guide: (typeof travelGuides)[number],
): Array<{ type: string; id: string; data: Record<string, unknown> }> {
  return [
    {
      type: "paragraph",
      id: `legacy-intro-${guide.slug}`,
      data: { text: guide.intro },
    },
    ...guide.sections.flatMap((section, index) => [
      {
        type: "heading",
        id: `legacy-heading-${guide.slug}-${index}`,
        data: { text: section.heading, level: 2 },
      },
      {
        type: "paragraph",
        id: `legacy-paragraph-${guide.slug}-${index}`,
        data: { text: section.body },
      },
    ]),
  ];
}

function fallbackCards(): PublicBlogCard[] {
  return travelGuides.map((guide) => ({
    slug: guide.slug,
    title: guide.title,
    excerpt: guide.excerpt,
    category: guide.category,
    heroUrl: null,
    heroClass: guide.heroClass,
    publishedAt: null,
    robotsIndex: true,
  }));
}

function fallbackDetail(slug: string): PublicBlogDetail | null {
  const guide = travelGuides.find((item) => item.slug === slug);
  if (!guide) return null;

  return {
    slug: guide.slug,
    title: guide.title,
    excerpt: guide.excerpt,
    category: guide.category,
    heroUrl: null,
    heroClass: guide.heroClass,
    publishedAt: null,
    robotsIndex: true,
    body: legacyBody(guide),
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    robotsFollow: true,
  };
}

export async function getPublicBlogPosts(): Promise<PublicBlogCard[]> {
  if (!process.env.DATABASE_URL) return fallbackCards();

  try {
    const db = getDb();
    const now = new Date();

    const rows = await db.blogPost.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        robotsIndex: true,
        category: { select: { name: true } },
        heroMedia: { select: { publicUrl: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    });

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      category: row.category?.name ?? "Travel Stories",
      heroUrl: row.heroMedia?.publicUrl ?? null,
      heroClass: null,
      publishedAt: row.publishedAt,
      robotsIndex: row.robotsIndex,
    }));
  } catch (error) {
    console.error(
      "[public-blog] Unable to load published blog posts:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return fallbackCards();
  }
}

export async function getPublicBlogPostBySlug(
  slug: string,
): Promise<PublicBlogDetail | null> {
  if (!process.env.DATABASE_URL) return fallbackDetail(slug);

  try {
    const db = getDb();
    const now = new Date();

    const row = await db.blogPost.findFirst({
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
        category: { select: { name: true } },
        heroMedia: { select: { publicUrl: true } },
      },
    });

    if (!row) return null;

    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      category: row.category?.name ?? "Travel Stories",
      heroUrl: row.heroMedia?.publicUrl ?? null,
      heroClass: null,
      publishedAt: row.publishedAt,
      robotsIndex: row.robotsIndex,
      body: row.body,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      canonicalUrl: row.canonicalUrl,
      robotsFollow: row.robotsFollow,
    };
  } catch (error) {
    console.error(
      "[public-blog] Unable to load blog post:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return fallbackDetail(slug);
  }
}
