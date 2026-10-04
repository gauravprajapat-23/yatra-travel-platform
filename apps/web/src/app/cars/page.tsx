import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Chauffeur-Driven Cars",
  description: "Explore comfortable chauffeur-driven cars for outstation and long-distance journeys.",
};

export default function CarsPage() {
  return (
    <PublicRouteShell
      eyebrow="OUR FLEET"
      title="Travel in comfort."
      description="Clean, maintained vehicles with professional drivers for family trips, temple journeys and long-distance travel."
      primaryHref="/custom-trip"
      primaryLabel="Plan a Car Journey"
    />
  );
}
