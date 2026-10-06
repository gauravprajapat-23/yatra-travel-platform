import { getDb } from "@yatra/db/client";

export type PublicFleetVehicle = {
  id: string;
  slug: string;
  displayName: string;
  className: string;
  seats: number;
  luggage: number | null;
  airConditioned: boolean;
  features: unknown;
  description: string | null;
  isFeatured: boolean;
  primaryImageUrl: string | null;
};

export async function getPublicFleet(): Promise<PublicFleetVehicle[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const db = getDb();

    const vehicles = await db.vehicle.findMany({
      where: {
        status: "ACTIVE",
        vehicleClass: { isActive: true },
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        seats: true,
        luggage: true,
        airConditioned: true,
        features: true,
        description: true,
        isFeatured: true,
        vehicleClass: {
          select: { name: true },
        },
        media: {
          where: { isPrimary: true },
          take: 1,
          select: {
            media: {
              select: { publicUrl: true },
            },
          },
        },
      },
      orderBy: [
        { isFeatured: "desc" },
        { displayName: "asc" },
      ],
    });

    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      slug: vehicle.slug,
      displayName: vehicle.displayName,
      className: vehicle.vehicleClass.name,
      seats: vehicle.seats,
      luggage: vehicle.luggage,
      airConditioned: vehicle.airConditioned,
      features: vehicle.features,
      description: vehicle.description,
      isFeatured: vehicle.isFeatured,
      primaryImageUrl: vehicle.media[0]?.media.publicUrl ?? null,
    }));
  } catch (error) {
    console.error(
      "[public-fleet] Unable to read active fleet:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return [];
  }
}


export type PublicFleetVehicleDetail = PublicFleetVehicle & {
  galleryUrls: string[];
};

export async function getPublicFleetVehicleBySlug(
  slug: string,
): Promise<PublicFleetVehicleDetail | null> {
  if (!process.env.DATABASE_URL) return null;

  try {
    const db = getDb();

    const vehicle = await db.vehicle.findFirst({
      where: {
        slug,
        status: "ACTIVE",
        vehicleClass: { isActive: true },
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        seats: true,
        luggage: true,
        airConditioned: true,
        features: true,
        description: true,
        isFeatured: true,
        vehicleClass: {
          select: { name: true },
        },
        media: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: {
            isPrimary: true,
            media: {
              select: {
                publicUrl: true,
              },
            },
          },
        },
      },
    });

    if (!vehicle) return null;

    const galleryUrls = vehicle.media.flatMap((item) =>
      item.media.publicUrl ? [item.media.publicUrl] : [],
    );

    const primaryImageUrl =
      vehicle.media.find((item) => item.isPrimary)?.media.publicUrl ??
      galleryUrls[0] ??
      null;

    return {
      id: vehicle.id,
      slug: vehicle.slug,
      displayName: vehicle.displayName,
      className: vehicle.vehicleClass.name,
      seats: vehicle.seats,
      luggage: vehicle.luggage,
      airConditioned: vehicle.airConditioned,
      features: vehicle.features,
      description: vehicle.description,
      isFeatured: vehicle.isFeatured,
      primaryImageUrl,
      galleryUrls,
    };
  } catch (error) {
    console.error(
      "[public-fleet] Unable to read vehicle detail:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return null;
  }
}
