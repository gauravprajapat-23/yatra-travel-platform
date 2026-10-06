import { getDb, Prisma } from "@yatra/db/client";

export const heroAssignmentTypes = ["cms", "blog", "destination", "package"] as const;
export type HeroAssignmentType = (typeof heroAssignmentTypes)[number];

export function isHeroAssignmentType(value: string): value is HeroAssignmentType {
  return (heroAssignmentTypes as readonly string[]).includes(value);
}

export async function assignHeroMedia(input: {
  type: HeroAssignmentType;
  entityId: string;
  mediaId: string | null;
  actorUserId: string;
}) {
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      let currentHeroMediaId: string | null = null;
      let entityLabel = "";

      if (input.type === "cms") {
        const entity = await tx.cmsPage.findUnique({
          where: { id: input.entityId },
          select: { id: true, title: true, heroMediaId: true },
        });
        if (!entity) throw new Error("CMS page not found.");
        currentHeroMediaId = entity.heroMediaId;
        entityLabel = entity.title;
      } else if (input.type === "blog") {
        const entity = await tx.blogPost.findUnique({
          where: { id: input.entityId },
          select: { id: true, title: true, heroMediaId: true },
        });
        if (!entity) throw new Error("Blog post not found.");
        currentHeroMediaId = entity.heroMediaId;
        entityLabel = entity.title;
      } else if (input.type === "destination") {
        const entity = await tx.destination.findUnique({
          where: { id: input.entityId },
          select: { id: true, name: true, heroMediaId: true },
        });
        if (!entity) throw new Error("Destination not found.");
        currentHeroMediaId = entity.heroMediaId;
        entityLabel = entity.name;
      } else {
        const entity = await tx.tourPackage.findUnique({
          where: { id: input.entityId },
          select: { id: true, title: true, heroMediaId: true },
        });
        if (!entity) throw new Error("Tour package not found.");
        currentHeroMediaId = entity.heroMediaId;
        entityLabel = entity.title;
      }

      if (input.mediaId) {
        const media = await tx.mediaAsset.findUnique({
          where: { id: input.mediaId },
          select: { id: true, mimeType: true, publicUrl: true },
        });

        if (!media) throw new Error("Media asset not found.");
        if (!media.mimeType.startsWith("image/")) {
          throw new Error("Hero media must be an image.");
        }
        if (!media.publicUrl) {
          throw new Error("Hero media must have a public URL.");
        }
      }

      if (input.type === "cms") {
        await tx.cmsPage.update({
          where: { id: input.entityId },
          data: { heroMediaId: input.mediaId },
        });
      } else if (input.type === "blog") {
        await tx.blogPost.update({
          where: { id: input.entityId },
          data: { heroMediaId: input.mediaId },
        });
      } else if (input.type === "destination") {
        await tx.destination.update({
          where: { id: input.entityId },
          data: { heroMediaId: input.mediaId },
        });
      } else {
        await tx.tourPackage.update({
          where: { id: input.entityId },
          data: { heroMediaId: input.mediaId },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "HERO_MEDIA_ASSIGNED",
          entityType: input.type,
          entityId: input.entityId,
          metadata: {
            label: entityLabel,
            fromMediaId: currentHeroMediaId,
            toMediaId: input.mediaId,
          },
        },
      });

      return {
        entityId: input.entityId,
        mediaId: input.mediaId,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
