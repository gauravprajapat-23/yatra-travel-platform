import { getDb } from "@yatra/db/client";

export type PublicPackageCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  durationDays: number;
  durationNights: number;
  heroUrl: string | null;
  price: {
    amountMinor: string;
    currency: string;
    mode: "PER_PERSON" | "PER_VEHICLE" | "PER_GROUP" | "FIXED";
  } | null;
};

export async function getPublicPackages(): Promise<PublicPackageCard[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const now = new Date();

    const packages = await db.tourPackage.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { publishedAt: null },
          { publishedAt: { lte: now } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        durationDays: true,
        durationNights: true,
        heroMedia: {
          select: { publicUrl: true },
        },
        priceOptions: {
          where: { isActive: true },
          select: {
            amountMinor: true,
            currency: true,
            mode: true,
          },
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
      orderBy: [
        { publishedAt: "desc" },
        { title: "asc" },
      ],
    });

    return packages.map((pkg) => ({
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      summary: pkg.summary,
      durationDays: pkg.durationDays,
      durationNights: pkg.durationNights,
      heroUrl: pkg.heroMedia?.publicUrl ?? null,
      price: pkg.priceOptions[0]
        ? {
            amountMinor: pkg.priceOptions[0].amountMinor.toString(),
            currency: pkg.priceOptions[0].currency,
            mode: pkg.priceOptions[0].mode,
          }
        : null,
    }));
  } catch (error) {
    console.error(
      "[public-packages] Unable to load published packages:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return [];
  }
}
