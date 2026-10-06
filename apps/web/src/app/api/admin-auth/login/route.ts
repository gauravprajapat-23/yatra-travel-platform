import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createAdminSession } from "@/lib/auth/session";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumeAdminLoginAttempt,
  loginIdentityHash,
} from "@/lib/auth/login-rate-limit";
import { hasPermission, type RoleKey } from "@yatra/domain/auth/permissions";

export const runtime = "nodejs";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function serviceUnavailable(code: string) {
  return NextResponse.json(
    {
      error: "Admin login service is temporarily unavailable.",
      code,
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function sameOrigin(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      {
        error: "Invalid request origin.",
        code: "INVALID_ORIGIN",
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  let body: LoginBody;
  try {
    body = await readJsonBody<LoginBody>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        {
          error:
            error.code === "BODY_TOO_LARGE"
              ? "Request is too large."
              : "Invalid request.",
          code: error.code,
        },
        {
          status: error.httpStatus,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    throw error;
  }

  const email =
    typeof body.email === "string"
      ? normalizeEmail(body.email)
      : "";
  const password =
    typeof body.password === "string"
      ? body.password
      : "";

  if (!email || !password || email.length > 320 || password.length > 256) {
    return NextResponse.json(
      { error: "Email and password are required." },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  if (!process.env.DATABASE_URL) {
    console.error("[admin-auth] DATABASE_URL is missing in the runtime environment.");
    return serviceUnavailable("AUTH_DATABASE_URL_MISSING");
  }

  try {
    const db = getDb();

    const limit = await consumeAdminLoginAttempt({
      request,
      normalizedEmail: email,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many sign-in attempts. Please try again later.",
          code: "LOGIN_RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const user = await db.user.findUnique({
      where: { emailNormalized: email },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    const genericError = { error: "Invalid email or password." };

    if (!user || !user.passwordHash || user.status !== "ACTIVE") {
      await db.auditLog.create({
        data: {
          action: "ADMIN_LOGIN_FAILED",
          entityType: user ? "User" : "LoginIdentity",
          entityId: user?.id ?? limit.identityHash,
          metadata: {
            reason:
              !user
                ? "UNKNOWN_IDENTITY"
                : !user.passwordHash
                  ? "PASSWORD_LOGIN_UNAVAILABLE"
                  : "ACCOUNT_INACTIVE",
          },
        },
      }).catch(() => undefined);

      return NextResponse.json(genericError, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    const roles = user.roles.map((entry) => entry.role.key) as RoleKey[];
    const hasAdminAccess = hasPermission(roles, "admin.access");

    if (!passwordOk || !hasAdminAccess) {
      await db.auditLog.create({
        data: {
          actorUserId: passwordOk ? user.id : null,
          action: "ADMIN_LOGIN_FAILED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            reason: passwordOk
              ? "ADMIN_ACCESS_DENIED"
              : "INVALID_CREDENTIALS",
          },
        },
      }).catch(() => undefined);

      return NextResponse.json(genericError, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const expiresAt = await createAdminSession(user.id, request);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "ADMIN_LOGIN_SUCCEEDED",
          entityType: "User",
          entityId: user.id,
          metadata: { roles },
        },
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
        },
        expiresAt: expiresAt.toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "[admin-auth] Login runtime failure:",
      error instanceof Error ? error.message : "Unknown database/runtime error",
    );

    const identityHash = loginIdentityHash(email);
    console.error(
      "[admin-auth] Login failure identity hash:",
      identityHash.slice(0, 12),
    );

    return serviceUnavailable("AUTH_DATABASE_UNAVAILABLE");
  }
}
