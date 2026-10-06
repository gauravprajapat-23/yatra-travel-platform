import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPublicDocument } from "@/components/cms-public-document";
import { getPublicCmsPageBySlug } from "@/lib/public-cms";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicCmsPageBySlug(slug);
  if (!page) return {};

  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? page.excerpt ?? undefined,
    alternates: page.canonicalUrl
      ? { canonical: page.canonicalUrl }
      : undefined,
    robots: {
      index: page.robotsIndex,
      follow: page.robotsFollow,
    },
  };
}

export default async function GenericCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicCmsPageBySlug(slug);

  if (!page) notFound();

  return <CmsPublicDocument page={page} eyebrow="YATRA" />;
}
