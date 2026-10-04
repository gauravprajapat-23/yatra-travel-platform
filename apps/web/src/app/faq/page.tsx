import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers about YATRA bookings, pricing, vehicles, tours and travel support.",
};

export default function FaqPage() {
  return (
    <PublicRouteShell
      eyebrow="FAQ"
      title="Questions before the road begins."
      description="Booking, pricing, cancellation, vehicles and travel-policy answers will be managed through the CMS and published here."
      primaryHref="/contact"
      primaryLabel="Contact Support"
    />
  );
}
