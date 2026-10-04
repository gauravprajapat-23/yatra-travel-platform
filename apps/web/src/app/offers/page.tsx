import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Travel Offers",
  description: "Explore current YATRA offers for selected tours and chauffeur-driven journeys.",
};

export default function OffersPage() {
  return (
    <PublicRouteShell
      eyebrow="SPECIAL OFFERS"
      title="Travel more. Save thoughtfully."
      description="Selected seasonal offers and journey promotions, presented with clear eligibility and transparent terms."
    />
  );
}
