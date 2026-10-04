import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Terms & Conditions",
};

export default function TermsPage() {
  return (
    <PublicRouteShell
      eyebrow="LEGAL"
      title="Terms & Conditions"
      description="Production booking, payment, liability and service terms will be reviewed and published before accepting live transactions."
      primaryHref="/contact"
      primaryLabel="Contact Us"
    />
  );
}
