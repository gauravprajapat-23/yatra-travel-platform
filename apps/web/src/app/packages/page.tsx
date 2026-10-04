import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Tour Packages",
  description: "Explore curated temple, heritage, nature and road-trip packages across India.",
};

export default function PackagesPage() {
  return (
    <PublicRouteShell
      eyebrow="CURATED JOURNEYS"
      title="Journeys worth remembering."
      description="Pilgrimage, heritage, nature and custom road trips built around meaningful experiences and comfortable travel."
      primaryLabel="Build My Trip"
    />
  );
}
