import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Travel Guides",
  description: "Read practical destination, temple and road-trip guides from YATRA.",
};

export default function TravelGuidesPage() {
  return (
    <PublicRouteShell
      eyebrow="TRAVEL INSPIRATION"
      title="Stories that make the road more meaningful."
      description="Useful destination guides, temple information, route ideas and practical planning advice."
    />
  );
}
