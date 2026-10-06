import { getDb } from "@yatra/db/client";

export type PublicFaq = {
  id: string;
  scope:
    | "GENERAL"
    | "BOOKING"
    | "PRICING"
    | "CANCELLATION"
    | "VEHICLES"
    | "PACKAGES";
  question: string;
  answer: string;
};

export async function getPublicFaqs(): Promise<PublicFaq[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const db = getDb();
    const now = new Date();

    const rows = await db.faq.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: now },
      },
      select: {
        id: true,
        scope: true,
        question: true,
        answer: true,
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

    return rows;
  } catch (error) {
    console.error(
      "[public-faqs] Unable to load published FAQs:",
      error instanceof Error ? error.message : "Unknown database error",
    );
    return [];
  }
}
