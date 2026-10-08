import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { requireCustomerSession } from "@/lib/auth/customer-session";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";

export const runtime = "nodejs";

type ProfileBody = {
  name?: unknown;
  phone?: unknown;
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

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Invalid request origin." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const session = await requireCustomerSession();
  if (!hasPermission(session.roles, "customer.self.write")) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Profile updates are not allowed." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: ProfileBody;
  try {
    body = await readJsonBody<ProfileBody>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        { error: { code: error.code, message: "Invalid request." } },
        { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (name.length > 120 || phone.length > 32) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PROFILE",
          message: "Profile details are too long.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getDb();
  const user = await db.user.update({
    where: { id: session.userId },
    data: {
      name: name || null,
      phone: phone || null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      emailVerifiedAt: true,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.userId,
      action: "CUSTOMER_PROFILE_UPDATED",
      entityType: "User",
      entityId: session.userId,
      metadata: {
        namePresent: Boolean(user.name),
        phonePresent: Boolean(user.phone),
      },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
