import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import "@/app/globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ConsentAnalytics } from "@/components/consent-analytics";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "YATRA — Chauffeur-Driven Journeys Across India",
    template: "%s | YATRA",
  },
  description:
    "Premium chauffeur-driven cars, temple circuits and curated road journeys across India.",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "YATRA",
    title: "YATRA — Chauffeur-Driven Journeys Across India",
    description:
      "Premium chauffeur-driven cars, temple circuits and curated road journeys across India.",
    images: [
      {
        url: "/assets/home-hero.webp",
        width: 1200,
        height: 630,
        alt: "YATRA chauffeur-driven journeys across India",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YATRA — Chauffeur-Driven Journeys Across India",
    description:
      "Premium chauffeur-driven cars, temple circuits and curated road journeys across India.",
    images: ["/assets/home-hero.webp"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${manrope.variable} ${playfair.variable}`} lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <SiteFooter />
        <ConsentAnalytics measurementId={process.env.GA_MEASUREMENT_ID?.trim()} />
      </body>
    </html>
  );
}
