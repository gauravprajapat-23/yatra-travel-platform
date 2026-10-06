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
        publishedAt: { lte: now },
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


export type PublicPackageDetail = PublicPackageCard & {
  body: unknown;
  destinations: Array<{ slug: string; name: string; kind: string }>;
  itinerary: Array<{ dayNumber: number; title: string; description: string | null }>;
  priceOptions: Array<{
    id: string;
    amountMinor: string;
    currency: string;
    mode: "PER_PERSON" | "PER_VEHICLE" | "PER_GROUP" | "FIXED";
    minTravellers: number | null;
    maxTravellers: number | null;
    vehicleClass: string | null;
  }>;
};

export async function getPublicPackageBySlug(
  slug: string,
): Promise<PublicPackageDetail | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = getDb();
    const now = new Date();

    const pkg = await db.tourPackage.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        body: true,
        durationDays: true,
        durationNights: true,
        heroMedia: { select: { publicUrl: true } },
        destinations: {
          orderBy: { sortOrder: "asc" },
          select: {
            destination: {
              select: {
                slug: true,
                name: true,
                kind: true,
              },
            },
          },
        },
        itinerary: {
          orderBy: { dayNumber: "asc" },
          select: {
            dayNumber: true,
            title: true,
            description: true,
          },
        },
        priceOptions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            amountMinor: true,
            currency: true,
            mode: true,
            minTravellers: true,
            maxTravellers: true,
            vehicleClass: { select: { name: true } },
          },
        },
      },
    });

    if (!pkg) return null;

    const first = pkg.priceOptions[0] ?? null;

    return {
      id: pkg.id,
      slug: pkg.slug,
      title: pkg.title,
      summary: pkg.summary,
      body: pkg.body,
      durationDays: pkg.durationDays,
      durationNights: pkg.durationNights,
      heroUrl: pkg.heroMedia?.publicUrl ?? null,
      price: first
        ? {
            amountMinor: first.amountMinor.toString(),
            currency: first.currency,
            mode: first.mode,
          }
        : null,
      destinations: pkg.destinations.map((item) => item.destination),
      itinerary: pkg.itinerary,
      priceOptions: pkg.priceOptions.map((option) => ({
        id: option.id,
        amountMinor: option.amountMinor.toString(),
        currency: option.currency,
        mode: option.mode,
        minTravellers: option.minTravellers,
        maxTravellers: option.maxTravellers,
        vehicleClass: option.vehicleClass?.name ?? null,
      })),
    };
  } catch (error) {
    console.error(
      "[public-packages] Unable to load package detail:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return null;
  }
}
