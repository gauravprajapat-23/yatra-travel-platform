import { randomUUID } from "node:crypto";
import { getDb, Prisma } from "@yatra/db/client";
import {
  assertStructuredContent,
  isAllowedContentBlockType,
  type StructuredContentBlock,
} from "@yatra/domain/content/structured-content";
import type { AdminContentType } from "./admin-content-service";

const MAX_BODY_JSON_CHARS = 200_000;
const MAX_BLOCKS = 100;

function parseBlocks(raw: string): StructuredContentBlock[] {
  if (raw.length > MAX_BODY_JSON_CHARS) {
    throw new Error("Structured content body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : [];
  } catch {
    throw new Error("Structured content must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Structured content body must be an array of blocks.");
  }

  if (parsed.length > MAX_BLOCKS) {
    throw new Error(`Structured content cannot exceed ${MAX_BLOCKS} blocks.`);
  }

  const blocks: StructuredContentBlock[] = parsed.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`Block ${index + 1} must be an object.`);
    }

    const source = value as Record<string, unknown>;
    const type = typeof source.type === "string" ? source.type : "";
    const id =
      typeof source.id === "string" && source.id.trim()
        ? source.id.trim().slice(0, 120)
        : randomUUID();

    if (!isAllowedContentBlockType(type)) {
      throw new Error(`Unsupported content block type at block ${index + 1}.`);
    }

    const data =
      typeof source.data === "object" &&
      source.data !== null &&
      !Array.isArray(source.data)
        ? (source.data as Record<string, unknown>)
        : {};

    return { type, id, data };
  });

  assertStructuredContent(blocks);
  return blocks;
}

export function stringifyStructuredBody(value: unknown): string {
  if (!Array.isArray(value)) return "[]";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[]";
  }
}

export async function updateStructuredContentBody(input: {
  type: AdminContentType;
  id: string;
  actorUserId: string;
  rawBody: string;
}) {
  const blocks = parseBlocks(input.rawBody);
  const db = getDb();

  return db.$transaction(
    async (tx) => {
      let currentBody: Prisma.JsonValue | null = null;

      if (input.type === "cms") {
        const current = await tx.cmsPage.findUnique({
          where: { id: input.id },
          select: { body: true },
        });
        if (!current) throw new Error("CMS page not found.");
        currentBody = current.body;
      } else if (input.type === "blog") {
        const current = await tx.blogPost.findUnique({
          where: { id: input.id },
          select: { body: true },
        });
        if (!current) throw new Error("Blog post not found.");
        currentBody = current.body;
      } else {
        const current = await tx.destination.findUnique({
          where: { id: input.id },
          select: { body: true },
        });
        if (!current) throw new Error("Destination not found.");
        currentBody = current.body;
      }

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
            body: currentBody,
          } as Prisma.InputJsonValue,
        },
      });

      const body = blocks as unknown as Prisma.InputJsonValue;

      if (input.type === "cms") {
        await tx.cmsPage.update({
          where: { id: input.id },
          data: { body },
        });
      } else if (input.type === "blog") {
        await tx.blogPost.update({
          where: { id: input.id },
          data: { body },
        });
      } else {
        await tx.destination.update({
          where: { id: input.id },
          data: { body },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "CONTENT_BODY_UPDATED",
          entityType: input.type,
          entityId: input.id,
          metadata: {
            blockCount: blocks.length,
            blockTypes: blocks.map((block) => block.type),
          },
        },
      });

      return { blockCount: blocks.length };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
