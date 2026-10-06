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
    }));
  } catch (error) {
    console.error(
      "[public-fleet] Unable to read active fleet:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return [];
  }
}
