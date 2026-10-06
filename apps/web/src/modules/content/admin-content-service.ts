import { getDb, Prisma } from "@yatra/db/client";

export const adminContentTypes = ["cms", "blog", "destination"] as const;
export type AdminContentType = (typeof adminContentTypes)[number];

export const contentStatuses = [
  "DRAFT",
  "REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type ContentStatusValue = (typeof contentStatuses)[number];

export function isAdminContentType(value: string): value is AdminContentType {
  return (adminContentTypes as readonly string[]).includes(value);
}

export function isContentStatus(value: string): value is ContentStatusValue {
  return (contentStatuses as readonly string[]).includes(value);
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function updateAdminContent(input: {
  type: AdminContentType;
  id: string;
  actorUserId: string;
  title: string;
  status: ContentStatusValue;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  scheduledFor: string;
}) {
  const db = getDb();
  const title = input.title.trim();

  if (title.length < 2 || title.length > 180) {
    throw new Error("Title must be between 2 and 180 characters.");
  }

  const scheduledFor =
    input.status === "SCHEDULED"
      ? new Date(input.scheduledFor)
      : null;

  if (
    input.status === "SCHEDULED" &&
    (!input.scheduledFor || Number.isNaN(scheduledFor?.getTime()))
  ) {
    throw new Error("A valid schedule date is required.");
  }

  return db.$transaction(
    async (tx) => {
      let current:
        | {
            id: string;
            title: string;
            status: ContentStatusValue;
            seoTitle: string | null;
            seoDescription: string | null;
            canonicalUrl: string | null;
            robotsIndex: boolean;
            robotsFollow: boolean;
            scheduledFor: Date | null;
            publishedAt: Date | null;
          }
        | null = null;

      if (input.type === "cms") {
        current = await tx.cmsPage.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            title: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            robotsFollow: true,
            scheduledFor: true,
            publishedAt: true,
          },
        });
      } else if (input.type === "blog") {
        current = await tx.blogPost.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            title: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            robotsFollow: true,
            scheduledFor: true,
            publishedAt: true,
          },
        });
      } else {
        const destination = await tx.destination.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            name: true,
            status: true,
            seoTitle: true,
            seoDescription: true,
            canonicalUrl: true,
            robotsIndex: true,
            robotsFollow: true,
            scheduledFor: true,
            publishedAt: true,
          },
        });
        current = destination
          ? { ...destination, title: destination.name }
          : null;
      }

      if (!current) throw new Error("Content record not found.");

      const latestRevision = await tx.contentRevision.aggregate({
        where: {
          entityType: input.type,
          entityId: input.id,
        },
        _max: { version: true },
      });

      await tx.contentRevision.create({
        data: {
          entityType: input.type,
          entityId: input.id,
          version: (latestRevision._max.version ?? 0) + 1,
          createdBy: input.actorUserId,
          payload: {
            title: current.title,
            status: current.status,
            seoTitle: current.seoTitle,
            seoDescription: current.seoDescription,
            canonicalUrl: current.canonicalUrl,
            robotsIndex: current.robotsIndex,
            robotsFollow: current.robotsFollow,
            scheduledFor: current.scheduledFor?.toISOString() ?? null,
            publishedAt: current.publishedAt?.toISOString() ?? null,
          } satisfies Prisma.InputJsonValue,
        },
      });

      const publishedAt =
        input.status === "PUBLISHED"
          ? current.publishedAt ?? new Date()
          : current.publishedAt;

      const common = {
        status: input.status,
        seoTitle: normalizeOptional(input.seoTitle),
        seoDescription: normalizeOptional(input.seoDescription),
        canonicalUrl: normalizeOptional(input.canonicalUrl),
        robotsIndex: input.robotsIndex,
        robotsFollow: input.robotsFollow,
        scheduledFor,
        publishedAt,
      };

      if (input.type === "cms") {
        await tx.cmsPage.update({
          where: { id: input.id },
          data: { title, ...common },
        });
      } else if (input.type === "blog") {
        await tx.blogPost.update({
          where: { id: input.id },
          data: { title, ...common },
        });
      } else {
        await tx.destination.update({
          where: { id: input.id },
          data: { name: title, ...common },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "CONTENT_UPDATED",
          entityType: input.type,
          entityId: input.id,
          metadata: {
            fromStatus: current.status,
            toStatus: input.status,
            title,
          },
        },
      });

      return { id: input.id, status: input.status };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
