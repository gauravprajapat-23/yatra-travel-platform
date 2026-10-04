import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <PublicRouteShell
      eyebrow="LEGAL"
      title="Privacy Policy"
      description="The production privacy notice will document data collection, purposes, retention, processors, customer rights and contact channels before launch."
      primaryHref="/contact"
      primaryLabel="Privacy Contact"
    />
  );
}
