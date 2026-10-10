import { NextResponse } from "next/server";
import { safeErrorName } from "@/lib/request-security";
import { getDb } from "@yatra/db/client";
import { hasPermission, type RoleKey } from "@yatra/domain/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import { createCustomerSession } from "@/lib/auth/customer-session";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import { consumePublicWriteAttempt, rateLimitedResponse } from "@/lib/public-write-rate-limit";

export const runtime = "nodejs";

type LoginBody = {
  email?: unknown;
  password?: unknown;
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

  let body: LoginBody;
  try {
    body = await readJsonBody<LoginBody>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        { error: { code: error.code, message: "Invalid request." } },
        { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (
    !email ||
    !password ||
    email.length > 320 ||
    password.length > 256
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const limit = await consumePublicWriteAttempt({
      request,
      scope: "customer-login",
      maxAttempts: 12,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return NextResponse.json(rateLimitedResponse(limit.retryAfterSeconds), {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(limit.retryAfterSeconds),
        },
      });
    }

    const db = getDb();
    const user = await db.user.findUnique({
      where: { emailNormalized: email },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    const genericError = {
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password.",
      },
    };

    if (
      !user ||
      !user.passwordHash ||
      user.status !== "ACTIVE" ||
      !user.emailVerifiedAt
    ) {
      await db.auditLog.create({
        data: {
          actorUserId: user?.id ?? null,
          action: "CUSTOMER_LOGIN_FAILED",
          entityType: user ? "User" : "CustomerLoginIdentity",
          entityId: user?.id ?? null,
          metadata: {
            reason: !user
              ? "UNKNOWN_IDENTITY"
              : !user.passwordHash
                ? "PASSWORD_LOGIN_UNAVAILABLE"
                : user.status !== "ACTIVE"
                  ? "ACCOUNT_INACTIVE"
                  : "EMAIL_UNVERIFIED",
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
    if (!passwordOk || !hasPermission(roles, "customer.self.read")) {
      await db.auditLog.create({
        data: {
          actorUserId: passwordOk ? user.id : null,
          action: "CUSTOMER_LOGIN_FAILED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            reason: passwordOk
              ? "CUSTOMER_ACCESS_DENIED"
              : "INVALID_CREDENTIALS",
          },
        },
      }).catch(() => undefined);

      return NextResponse.json(genericError, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const expiresAt = await createCustomerSession(user.id, request);
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "CUSTOMER_LOGIN_SUCCEEDED",
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
        },
        expiresAt: expiresAt.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[customer-auth] login failed",
      safeErrorName(error),
    );
    return NextResponse.json(
      {
        error: {
          code: "AUTH_UNAVAILABLE",
          message: "Unable to sign in right now.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
