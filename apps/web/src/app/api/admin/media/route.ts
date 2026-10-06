import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { getAdminSession } from "@/lib/auth/session";
import { storeAdminMedia } from "@/modules/media/media-storage-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!origin || !appUrl) return process.env.NODE_ENV !== "production";

  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Invalid request origin." } },
      { status: 403 },
    );
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Admin sign-in required." } },
      { status: 401 },
    );
  }

  if (!hasPermission(session.roles, "content.write")) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Media write permission required." } },
      { status: 403 },
    );
  }

  try {
    const db = getDb();
    const recentUploads = await db.auditLog.count({
      where: {
        actorUserId: session.userId,
        action: "MEDIA_UPLOADED",
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentUploads >= 100) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Media upload limit reached. Try again later." } },
        { status: 429 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "FILE_REQUIRED", message: "A media file is required." } },
        { status: 400 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const asset = await storeAdminMedia({
      bytes,
      originalName: file.name,
      declaredMimeType: file.type,
      altText: String(form.get("altText") ?? ""),
      caption: String(form.get("caption") ?? ""),
      actorUserId: session.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        asset: {
          id: asset.id,
          objectKey: asset.objectKey,
          publicUrl: asset.publicUrl,
          mimeType: asset.mimeType,
          byteSize: asset.byteSize?.toString() ?? null,
          altText: asset.altText,
          caption: asset.caption,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin-media] upload failed", error);
    return NextResponse.json(
      {
        error: {
          code: "MEDIA_UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "Unable to upload media.",
        },
      },
      { status: 400 },
    );
  }
}
