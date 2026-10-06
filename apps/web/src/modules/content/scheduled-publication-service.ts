import { getDb, Prisma } from "@yatra/db/client";

type ScheduledEntityType =
  | "CmsPage"
  | "BlogPost"
  | "Destination"
  | "TourPackage"
  | "Faq";

type PublishResult = {
  entityType: ScheduledEntityType;
  published: number;
};

export async function publishDueScheduledContent(
  now = new Date(),
): Promise<{
  totalPublished: number;
  results: PublishResult[];
}> {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const results: PublishResult[] = [];

      async function publishCmsPages() {
        const rows = await tx.cmsPage.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { lte: now },
          },
          select: { id: true, slug: true },
          take: 200,
        });

        let published = 0;

        for (const row of rows) {
          const changed = await tx.cmsPage.updateMany({
            where: {
              id: row.id,
              status: "SCHEDULED",
              scheduledFor: { lte: now },
            },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              scheduledFor: null,
            },
          });

          if (changed.count !== 1) continue;
          published += 1;

          await tx.auditLog.create({
            data: {
              action: "SCHEDULED_CONTENT_PUBLISHED",
              entityType: "CmsPage",
              entityId: row.id,
              metadata: { slug: row.slug, publishedAt: now.toISOString() },
            },
          });
        }

        results.push({ entityType: "CmsPage", published });
      }

      async function publishBlogPosts() {
        const rows = await tx.blogPost.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { lte: now },
          },
          select: { id: true, slug: true },
          take: 200,
        });

        let published = 0;

        for (const row of rows) {
          const changed = await tx.blogPost.updateMany({
            where: {
              id: row.id,
              status: "SCHEDULED",
              scheduledFor: { lte: now },
            },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              scheduledFor: null,
            },
          });

          if (changed.count !== 1) continue;
          published += 1;

          await tx.auditLog.create({
            data: {
              action: "SCHEDULED_CONTENT_PUBLISHED",
              entityType: "BlogPost",
              entityId: row.id,
              metadata: { slug: row.slug, publishedAt: now.toISOString() },
            },
          });
        }

        results.push({ entityType: "BlogPost", published });
      }

      async function publishDestinations() {
        const rows = await tx.destination.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { lte: now },
          },
          select: { id: true, slug: true },
          take: 200,
        });

        let published = 0;

        for (const row of rows) {
          const changed = await tx.destination.updateMany({
            where: {
              id: row.id,
              status: "SCHEDULED",
              scheduledFor: { lte: now },
            },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              scheduledFor: null,
            },
          });

          if (changed.count !== 1) continue;
          published += 1;

          await tx.auditLog.create({
            data: {
              action: "SCHEDULED_CONTENT_PUBLISHED",
              entityType: "Destination",
              entityId: row.id,
              metadata: { slug: row.slug, publishedAt: now.toISOString() },
            },
          });
        }

        results.push({ entityType: "Destination", published });
      }

      async function publishPackages() {
        const rows = await tx.tourPackage.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { lte: now },
          },
          select: { id: true, slug: true },
          take: 200,
        });

        let published = 0;

        for (const row of rows) {
          const changed = await tx.tourPackage.updateMany({
            where: {
              id: row.id,
              status: "SCHEDULED",
              scheduledFor: { lte: now },
            },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              scheduledFor: null,
            },
          });

          if (changed.count !== 1) continue;
          published += 1;

          await tx.auditLog.create({
            data: {
              action: "SCHEDULED_CONTENT_PUBLISHED",
              entityType: "TourPackage",
              entityId: row.id,
              metadata: { slug: row.slug, publishedAt: now.toISOString() },
            },
          });
        }

        results.push({ entityType: "TourPackage", published });
      }

      async function publishFaqs() {
        const rows = await tx.faq.findMany({
          where: {
            status: "SCHEDULED",
            scheduledFor: { lte: now },
          },
          select: { id: true, scope: true },
          take: 200,
        });

        let published = 0;

        for (const row of rows) {
          const changed = await tx.faq.updateMany({
            where: {
              id: row.id,
              status: "SCHEDULED",
              scheduledFor: { lte: now },
            },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              scheduledFor: null,
            },
          });

          if (changed.count !== 1) continue;
          published += 1;

          await tx.auditLog.create({
            data: {
              action: "SCHEDULED_CONTENT_PUBLISHED",
              entityType: "Faq",
              entityId: row.id,
              metadata: { scope: row.scope, publishedAt: now.toISOString() },
            },
          });
        }

        results.push({ entityType: "Faq", published });
      }

      await publishCmsPages();
      await publishBlogPosts();
      await publishDestinations();
      await publishPackages();
      await publishFaqs();

      return {
        totalPublished: results.reduce(
          (sum, item) => sum + item.published,
          0,
        ),
        results,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
