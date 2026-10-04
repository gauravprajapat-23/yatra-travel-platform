export const packagePriceModes = [
  "PER_PERSON",
  "PER_VEHICLE",
  "PER_GROUP",
  "FIXED",
] as const;

export type PackagePriceMode = (typeof packagePriceModes)[number];

export type PackagePriceInput = {
  mode: PackagePriceMode;
  amountMinor: bigint;
  travellers: number;
  vehicleCount?: number | null;
};

export type PackageBasePrice = {
  quantity: number;
  subtotalMinor: bigint;
};

export function calculatePackageBasePrice(
  input: PackagePriceInput,
): PackageBasePrice {
  if (input.amountMinor < 0n) {
    throw new Error("Package amount cannot be negative.");
  }

  if (!Number.isInteger(input.travellers) || input.travellers <= 0) {
    throw new Error("Travellers must be a positive integer.");
  }

  let quantity: number;

  switch (input.mode) {
    case "PER_PERSON":
      quantity = input.travellers;
      break;
    case "PER_VEHICLE":
      if (
        !Number.isInteger(input.vehicleCount) ||
        (input.vehicleCount ?? 0) <= 0
      ) {
        throw new Error(
          "PER_VEHICLE package pricing requires a positive vehicle count.",
        );
      }
      quantity = input.vehicleCount!;
      break;
    case "PER_GROUP":
    case "FIXED":
      quantity = 1;
      break;
  }

  return {
    quantity,
    subtotalMinor: input.amountMinor * BigInt(quantity),
  };
}

export function assertTravellerRange(input: {
  travellers: number;
  minTravellers: number | null;
  maxTravellers: number | null;
}): void {
  if (
    input.minTravellers !== null &&
    input.travellers < input.minTravellers
  ) {
    throw new Error("Traveller count is below this package price option.");
  }

  if (
    input.maxTravellers !== null &&
    input.travellers > input.maxTravellers
  ) {
    throw new Error("Traveller count exceeds this package price option.");
  }
}
