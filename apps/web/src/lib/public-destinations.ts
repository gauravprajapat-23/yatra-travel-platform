import { getDb } from "@yatra/db/client";

export type PublicDestinationCard = {
  id: string;
  slug: string;
  name: string;
  kind: "CITY" | "TEMPLE" | "NATURE" | "HERITAGE" | "REGION";
  summary: string | null;
  heroUrl: string | null;
  isFeatured: boolean;
};

export type PublicDestinationDetail = PublicDestinationCard & {
  body: unknown;
  templeProfile: {
    templeName: string;
    deity: string | null;
    darshanNotes: string | null;
    dressCode: string | null;
    openingHours: unknown;
    nearbyPlaces: unknown;
    practicalNotes: unknown;
  } | null;
};

export async function getPublicDestinations(): Promise<PublicDestinationCard[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const now = new Date();

    const rows = await db.destination.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        summary: true,
        isFeatured: true,
        heroMedia: { select: { publicUrl: true } },
      },
      orderBy: [
        { isFeatured: "desc" },
        { name: "asc" },
      ],
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      summary: row.summary,
      heroUrl: row.heroMedia?.publicUrl ?? null,
      isFeatured: row.isFeatured,
    }));
  } catch (error) {
    console.error(
      "[public-destinations] Unable to load destinations:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return [];
  }
}

export async function getPublicDestinationBySlug(
  slug: string,
): Promise<PublicDestinationDetail | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = getDb();
    const now = new Date();

    const row = await db.destination.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        summary: true,
        body: true,
        isFeatured: true,
        heroMedia: { select: { publicUrl: true } },
        templeProfile: {
          select: {
            templeName: true,
            deity: true,
            darshanNotes: true,
            dressCode: true,
            openingHours: true,
            nearbyPlaces: true,
            practicalNotes: true,
          },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      summary: row.summary,
      body: row.body,
      heroUrl: row.heroMedia?.publicUrl ?? null,
      isFeatured: row.isFeatured,
      templeProfile: row.templeProfile,
    };
  } catch (error) {
    console.error(
      "[public-destinations] Unable to load destination detail:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return null;
  }
}
