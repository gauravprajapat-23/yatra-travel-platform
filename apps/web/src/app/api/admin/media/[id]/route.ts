import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { getAdminSession } from "@/lib/auth/session";
import { deleteAdminMedia } from "@/modules/media/media-storage-service";

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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (process.env.MEDIA_WRITE_ENABLED !== "true") {
    return NextResponse.json(
      { error: { code: "MEDIA_WRITES_DISABLED", message: "Media deletion is temporarily disabled." } },
      { status: 503 },
    );
  }

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

  const { id } = await context.params;
  if (!id || id.length > 128) {
    return NextResponse.json(
      { error: { code: "INVALID_MEDIA_ID", message: "Invalid media id." } },
      { status: 400 },
    );
  }

  try {
    const result = await deleteAdminMedia({
      mediaId: id,
      actorUserId: session.userId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete media.";
    const status = message.includes("referenced") ? 409 : message.includes("not found") ? 404 : 400;

    return NextResponse.json(
      { error: { code: "MEDIA_DELETE_FAILED", message } },
      { status },
    );
  }
}


export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (process.env.MEDIA_WRITE_ENABLED !== "true") {
    return NextResponse.json(
      { error: { code: "MEDIA_WRITES_DISABLED", message: "Media updates are temporarily disabled." } },
      { status: 503 },
    );
  }

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

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  const source =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const altText =
    typeof source.altText === "string"
      ? source.altText.trim().slice(0, 300)
      : "";
  const caption =
    typeof source.caption === "string"
      ? source.caption.trim().slice(0, 500)
      : "";

  try {
    const db = getDb();

    const asset = await db.$transaction(async (tx) => {
      const updated = await tx.mediaAsset.update({
        where: { id },
        data: {
          altText: altText || null,
          caption: caption || null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: "MEDIA_METADATA_UPDATED",
          entityType: "MediaAsset",
          entityId: id,
          metadata: {
            altText: updated.altText,
            caption: updated.caption,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: asset.id,
        altText: asset.altText,
        caption: asset.caption,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update media metadata.";
    const status = message.includes("Record to update not found") ? 404 : 400;

    return NextResponse.json(
      { error: { code: "MEDIA_UPDATE_FAILED", message } },
      { status },
    );
  }
}
