import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Destinations",
  description: "Discover Indian destinations, temple towns and road-trip ideas with YATRA.",
};

export default function DestinationsPage() {
  return (
    <PublicRouteShell
      eyebrow="DISCOVER INDIA"
      title="Destinations with a story."
      description="Explore sacred cities, heritage routes, nature escapes and places made better by the road that takes you there."
    />
  );
}
