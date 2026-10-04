import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Custom Trip Builder",
  description: "Plan a custom chauffeur-driven journey with YATRA.",
  robots: { index: false, follow: false },
};

export default function CustomTripPage() {
  return (
    <PublicRouteShell
      eyebrow="PLAN YOUR OWN JOURNEY"
      title="Build a trip around you."
      description="Tell us your route, dates, travellers and preferred vehicle. The final quote will always be calculated and verified on the server."
      primaryHref="/contact"
      primaryLabel="Talk to a Travel Expert"
    />
  );
}
