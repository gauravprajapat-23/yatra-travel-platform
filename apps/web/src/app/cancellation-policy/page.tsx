import type { Metadata } from "next";
import { CmsPublicDocument } from "@/components/cms-public-document";
import { PublicRouteShell } from "@/components/public-route-shell";
import { getPublicCmsPageBySlug } from "@/lib/public-cms";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPublicCmsPageBySlug("cancellation-policy");

  if (!page) {
    return {
      title: "Cancellation Policy",
      description: "The Cancellation Policy is not published yet.",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? page.excerpt ?? undefined,
    alternates: page.canonicalUrl ? { canonical: page.canonicalUrl } : undefined,
    robots: {
      index: page.robotsIndex,
      follow: page.robotsFollow,
    },
  };
}

export default async function Page() {
  const page = await getPublicCmsPageBySlug("cancellation-policy");

  if (!page) {
    return (
      <PublicRouteShell
        eyebrow="LEGAL"
        title="Cancellation Policy"
        description="The Cancellation Policy is not published yet. Live paid bookings remain blocked until this required legal document is published."
        primaryHref="/contact"
        primaryLabel="Contact Us"
      />
    );
  }

  return <CmsPublicDocument page={page} />;
}
