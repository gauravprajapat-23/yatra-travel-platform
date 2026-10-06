import type { Metadata } from "next";
import { CarSearchResults } from "@/components/car-search-results";

export const metadata: Metadata = {
  title: "Car Search Results",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 30 ? parsed : fallback;
}

export default async function CarSearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const from = first(params.from, "Raipur").trim().slice(0, 120);
  const to = first(params.to, "Ujjain").trim().slice(0, 120);
  const departure = first(params.departure).trim().slice(0, 20);
  const returnDate = first(params.return).trim().slice(0, 20);
  const travellers = positiveInt(first(params.travellers, "4"), 4);
  const tripType =
    first(params.tripType) === "ONE_WAY" || !returnDate
      ? "ONE_WAY"
      : "ROUND_TRIP";

  return (
    <section className="reference-section reference-section--cream car-search-reference">
      <CarSearchResults
        search={{
          from: from || "Raipur",
          to: to || "Ujjain",
          departure,
          returnDate,
          travellers,
          tripType,
        }}
      />
    </section>
  );
}
