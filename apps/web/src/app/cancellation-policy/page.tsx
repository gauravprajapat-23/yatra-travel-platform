import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "Cancellation Policy",
};

export default function CancellationPolicyPage() {
  return (
    <PublicRouteShell
      eyebrow="LEGAL"
      title="Cancellation Policy"
      description="Cancellation and refund rules are intentionally not invented in code. Final business rules will be configurable, versioned and snapshotted with confirmed bookings."
      primaryHref="/contact"
      primaryLabel="Ask About a Booking"
    />
  );
}
