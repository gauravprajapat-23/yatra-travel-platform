import { randomUUID } from "node:crypto";
import { getDb } from "@yatra/db/client";
import {
  deleteStorageObject,
  putStorageObject,
} from "@yatra/providers/storage/s3-client";

const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

type SupportedMedia = {
  mimeType: string;
  extension: string;
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return Buffer.from(bytes.slice(start, start + length)).toString("ascii");
}

function detectMedia(bytes: Uint8Array): SupportedMedia | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mimeType: "image/png", extension: "png" };
  }

  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") {
    return { mimeType: "image/gif", extension: "gif" };
  }

  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }

  if (ascii(bytes, 0, 5) === "%PDF-") {
    return { mimeType: "application/pdf", extension: "pdf" };
  }

  return null;
}

function slugifyBaseName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  const slug = withoutExtension
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);

  return slug || "media";
}

export async function storeAdminMedia(input: {
  bytes: Uint8Array;
  originalName: string;
  declaredMimeType: string;
  altText?: string;
  caption?: string;
  actorUserId: string;
}) {
  if (input.bytes.byteLength === 0) {
    throw new Error("Uploaded file is empty.");
  }

  if (input.bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new Error("Uploaded file exceeds the 10 MB limit.");
  }

  const detected = detectMedia(input.bytes);
  if (!detected) {
    throw new Error("Unsupported or invalid file contents.");
  }

  if (
    input.declaredMimeType &&
    input.declaredMimeType !== "application/octet-stream" &&
    input.declaredMimeType !== detected.mimeType
  ) {
    throw new Error("Declared file type does not match the file contents.");
  }

  const now = new Date();
  const datePath = [
    now.getUTCFullYear().toString(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
  ].join("/");
  const objectKey = [
    "media",
    datePath,
    `${slugifyBaseName(input.originalName)}-${randomUUID()}.${detected.extension}`,
  ].join("/");

  const stored = await putStorageObject({
    objectKey,
    body: input.bytes,
    contentType: detected.mimeType,
  });

  if (!stored.publicUrl) {
    try {
      await deleteStorageObject(objectKey);
    } catch {
      // Best-effort rollback of an object that cannot be served publicly.
    }
    throw new Error("STORAGE_PUBLIC_BASE_URL is required for media uploads.");
  }

  const db = getDb();

  try {
    return await db.$transaction(async (tx) => {
      const asset = await tx.mediaAsset.create({
        data: {
          storageProvider: "s3",
          bucket: process.env.STORAGE_BUCKET?.trim() || null,
          objectKey,
          publicUrl: stored.publicUrl,
          mimeType: detected.mimeType,
          byteSize: BigInt(input.bytes.byteLength),
          altText: input.altText?.trim().slice(0, 300) || null,
          caption: input.caption?.trim().slice(0, 500) || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "MEDIA_UPLOADED",
          entityType: "MediaAsset",
          entityId: asset.id,
          metadata: {
            objectKey,
            mimeType: detected.mimeType,
            byteSize: input.bytes.byteLength,
          },
        },
      });

      return asset;
    });
  } catch (error) {
    try {
      await deleteStorageObject(objectKey);
    } catch {
      // The DB write failed; leave cleanup to storage lifecycle if rollback fails.
    }
    throw error;
  }
}

export async function deleteAdminMedia(input: {
  mediaId: string;
  actorUserId: string;
}) {
  const db = getDb();

  const asset = await db.mediaAsset.findUnique({
    where: { id: input.mediaId },
    include: {
      _count: {
        select: {
          cmsPageHeroes: true,
          destinationHero: true,
          blogPostHeroes: true,
          vehicleMedia: true,
          packageHeroes: true,
        },
      },
    },
  });

  if (!asset) throw new Error("Media asset not found.");

  const referenceCount =
    asset._count.cmsPageHeroes +
    asset._count.destinationHero +
    asset._count.blogPostHeroes +
    asset._count.vehicleMedia +
    asset._count.packageHeroes;

  if (referenceCount > 0) {
    throw new Error("Media asset is still referenced and cannot be deleted.");
  }

  await db.$transaction(async (tx) => {
    await tx.mediaAsset.delete({ where: { id: asset.id } });
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "MEDIA_DELETED",
        entityType: "MediaAsset",
        entityId: asset.id,
        metadata: {
          objectKey: asset.objectKey,
          mimeType: asset.mimeType,
        },
      },
    });
  });

  try {
    await deleteStorageObject(asset.objectKey);
    return { deleted: true, storageDeleted: true };
  } catch {
    await db.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "MEDIA_STORAGE_DELETE_FAILED",
        entityType: "MediaAsset",
        entityId: asset.id,
        metadata: { objectKey: asset.objectKey },
      },
    });

    return { deleted: true, storageDeleted: false };
  }
}
