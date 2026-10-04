import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact YATRA for travel planning, booking support and custom journey enquiries.",
};

export default function ContactPage() {
  return (
    <PublicRouteShell
      eyebrow="CONTACT"
      title="Let’s plan the journey."
      description="Share your route, dates and travel needs. Contact workflows will be connected to the lead-management domain in a later phase."
      primaryHref="/custom-trip"
      primaryLabel="Build a Custom Trip"
    />
  );
}
