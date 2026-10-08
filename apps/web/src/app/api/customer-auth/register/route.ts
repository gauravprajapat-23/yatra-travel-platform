import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hashPassword } from "@/lib/auth/password";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import { consumePublicWriteAttempt, rateLimitedResponse } from "@/lib/public-write-rate-limit";
import { getEmailNotificationProvider } from "@/modules/notifications/provider-factory";
import { sendAuthActionNotification } from "@/modules/notifications/auth-notification-service";

export const runtime = "nodejs";

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
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
  if (process.env.CUSTOMER_AUTH_WRITE_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "REGISTRATION_DISABLED",
          message: "Customer registration is not enabled yet.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN", message: "Invalid request origin." } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: RegisterBody;
  try {
    body = await readJsonBody<RegisterBody>(request, 4096);
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
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 320 ||
    password.length < 10 ||
    password.length > 256
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REGISTRATION",
          message: "Enter a valid email and a password of at least 10 characters.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const limit = await consumePublicWriteAttempt({
      request,
      scope: "customer-register",
      maxAttempts: 5,
      windowMs: 60 * 60 * 1000,
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

    const provider = getEmailNotificationProvider();

    const db = getDb();
    const existing = await db.user.findUnique({
      where: { emailNormalized: email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_UNAVAILABLE",
            message: "Unable to create an account with those details.",
          },
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const customerRole = await db.role.findUnique({
      where: { key: "CUSTOMER" },
      select: { id: true },
    });
    if (!customerRole) {
      throw new Error("CUSTOMER role is not seeded.");
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        emailNormalized: email,
        passwordHash,
        name: name || null,
        status: "ACTIVE",
        emailVerifiedAt: null,
        roles: {
          create: {
            roleId: customerRole.id,
          },
        },
      },
      select: { id: true },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "CUSTOMER_REGISTRATION_CREATED_UNVERIFIED",
        entityType: "User",
        entityId: user.id,
      },
    });

    await sendAuthActionNotification({
      userId: user.id,
      destinationEmail: email,
      purpose: "EMAIL_VERIFICATION",
      provider,
    });

    return NextResponse.json(
      {
        ok: true,
        verificationRequired: true,
        message: "Account created. Check your email to verify the account before sign-in.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "[customer-auth] registration failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error: {
          code: "REGISTRATION_UNAVAILABLE",
          message: "Unable to create an account right now.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
