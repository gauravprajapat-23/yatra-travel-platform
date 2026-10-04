export type VehiclePublicSource = {
  id: string;
  slug: string;
  displayName: string;
  seats: number;
  luggage: number | null;
  airConditioned: boolean;
  features: unknown;
  description: string | null;
  isFeatured: boolean;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "RETIRED";
  registrationNumber: string;
};

export type PublicVehicleDto = {
  id: string;
  slug: string;
  displayName: string;
  seats: number;
  luggage: number | null;
  airConditioned: boolean;
  features: unknown;
  description: string | null;
  isFeatured: boolean;
};

export function toPublicVehicleDto(
  vehicle: VehiclePublicSource,
): PublicVehicleDto {
  if (vehicle.status !== "ACTIVE") {
    throw new Error("Only active vehicles may be exposed publicly.");
  }

  return {
    id: vehicle.id,
    slug: vehicle.slug,
    displayName: vehicle.displayName,
    seats: vehicle.seats,
    luggage: vehicle.luggage,
    airConditioned: vehicle.airConditioned,
    features: vehicle.features,
    description: vehicle.description,
    isFeatured: vehicle.isFeatured,
  };
}
