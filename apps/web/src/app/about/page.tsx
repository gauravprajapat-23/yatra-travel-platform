import type { Metadata } from "next";
import { PublicRouteShell } from "@/components/public-route-shell";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about YATRA and our approach to comfortable, reliable journeys across India.",
};

export default function AboutPage() {
  return (
    <PublicRouteShell
      eyebrow="ABOUT YATRA"
      title="Driven by a deeper love for the journey."
      description="We are building travel around reliable vehicles, thoughtful routes, trusted service and a more human way to experience India."
    />
  );
}
