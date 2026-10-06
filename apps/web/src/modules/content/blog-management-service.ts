import { getDb, Prisma } from "@yatra/db/client";

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function createBlogCategory(input: {
  name: string;
  slug: string;
  description: string;
  actorUserId: string;
}) {
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug || input.name);

  if (name.length < 2 || name.length > 120) {
    throw new Error("Category name must be between 2 and 120 characters.");
  }
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Invalid category slug.");
  }

  const db = getDb();

  return db.$transaction(async (tx) => {
    const existing = await tx.blogCategory.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) throw new Error("A blog category with this slug already exists.");

    const category = await tx.blogCategory.create({
      data: {
        name,
        slug,
        description: input.description.trim().slice(0, 1000) || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "BLOG_CATEGORY_CREATED",
        entityType: "BlogCategory",
        entityId: category.id,
        metadata: { name, slug },
      },
    });

    return category;
  });
}

export async function updateBlogCategory(input: {
  categoryId: string;
  name: string;
  description: string;
  actorUserId: string;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new Error("Category name must be between 2 and 120 characters.");
  }

  const db = getDb();

  return db.$transaction(async (tx) => {
    const current = await tx.blogCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true, name: true, slug: true, description: true },
    });
    if (!current) throw new Error("Blog category not found.");

    const category = await tx.blogCategory.update({
      where: { id: input.categoryId },
      data: {
        name,
        description: input.description.trim().slice(0, 1000) || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "BLOG_CATEGORY_UPDATED",
        entityType: "BlogCategory",
        entityId: category.id,
        metadata: {
          slug: category.slug,
          fromName: current.name,
          toName: category.name,
        },
      },
    });

    return category;
  });
}

export async function updateBlogDetails(input: {
  postId: string;
  excerpt: string;
  categoryId: string | null;
  actorUserId: string;
}) {
  const excerpt = input.excerpt.trim();
  if (excerpt.length > 500) {
    throw new Error("Blog excerpt cannot exceed 500 characters.");
  }

  const db = getDb();

  return db.$transaction(
    async (tx) => {
      const current = await tx.blogPost.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          excerpt: true,
          categoryId: true,
        },
      });
      if (!current) throw new Error("Blog post not found.");

      if (input.categoryId) {
        const category = await tx.blogCategory.findUnique({
          where: { id: input.categoryId },
          select: { id: true },
        });
        if (!category) throw new Error("Selected blog category does not exist.");
      }

      const latestRevision = await tx.contentRevision.aggregate({
        where: {
          entityType: "blog",
          entityId: input.postId,
        },
        _max: { version: true },
      });

      await tx.contentRevision.create({
        data: {
          entityType: "blog",
          entityId: input.postId,
          version: (latestRevision._max.version ?? 0) + 1,
          createdBy: input.actorUserId,
          payload: {
            excerpt: current.excerpt,
            categoryId: current.categoryId,
          } as Prisma.InputJsonValue,
        },
      });

      const updated = await tx.blogPost.update({
        where: { id: input.postId },
        data: {
          excerpt: excerpt || null,
          categoryId: input.categoryId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "BLOG_DETAILS_UPDATED",
          entityType: "BlogPost",
          entityId: input.postId,
          metadata: {
            fromCategoryId: current.categoryId,
            toCategoryId: input.categoryId,
          },
        },
      });

      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
