import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireCustomerSession } from "@/lib/auth/customer-session";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";

export const runtime = "nodejs";

type PasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

function sameOrigin(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = request.headers.get("origin");
  if (!appUrl || !origin) return false;

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
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const session = await requireCustomerSession();

  let body: PasswordBody;
  try {
    body = await readJsonBody<PasswordBody>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        { error: { code: error.code, message: "Invalid request." } },
        { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (
    !currentPassword ||
    newPassword.length < 10 ||
    newPassword.length > 256 ||
    currentPassword.length > 256
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PASSWORD_CHANGE",
          message: "Enter your current password and a new password of at least 10 characters.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      {
        error: {
          code: "PASSWORD_UNCHANGED",
          message: "Choose a new password different from your current password.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getDb();
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  });

  if (
    !user?.passwordHash ||
    !(await verifyPassword(currentPassword, user.passwordHash))
  ) {
    return NextResponse.json(
      {
        error: {
          code: "CURRENT_PASSWORD_INVALID",
          message: "Current password is incorrect.",
        },
      },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await db.$transaction([
    db.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    }),
    db.session.updateMany({
      where: {
        userId: session.userId,
        id: { not: session.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: now },
    }),
    db.auditLog.create({
      data: {
        actorUserId: session.userId,
        action: "CUSTOMER_PASSWORD_CHANGED",
        entityType: "User",
        entityId: session.userId,
      },
    }),
  ]);

  return NextResponse.json(
    { ok: true, message: "Password updated. Other sessions were signed out." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
