import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import { getEmailNotificationProvider } from "@/modules/notifications/provider-factory";
import { sendAuthActionNotification } from "@/modules/notifications/auth-notification-service";

export const runtime = "nodejs";

type RequestBody = {
  email?: unknown;
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

const genericResponse = {
  ok: true,
  message: "If a verified account exists for that email, a reset link will be sent.",
};

export async function POST(request: Request) {
  if (process.env.CUSTOMER_PASSWORD_RESET_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "PASSWORD_RESET_DISABLED",
          message: "Password reset is not enabled yet.",
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

  let provider;
  try {
    provider = getEmailNotificationProvider();
  } catch (error) {
    console.error(
      "[customer-auth] password reset provider unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error: {
          code: "PASSWORD_RESET_UNAVAILABLE",
          message: "Password reset is temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const limit = await consumePublicWriteAttempt({
    request,
    scope: "customer-password-reset",
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

  let body: RequestBody;
  try {
    body = await readJsonBody<RequestBody>(request, 2048);
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

  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(genericResponse, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const db = getDb();
  const user = await db.user.findFirst({
    where: {
      emailNormalized: email,
      status: "ACTIVE",
      emailVerifiedAt: { not: null },
      roles: {
        some: {
          role: { key: "CUSTOMER" },
        },
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (user) {
    try {
      await sendAuthActionNotification({
        userId: user.id,
        destinationEmail: user.email,
        purpose: "PASSWORD_RESET",
        provider,
      });
    } catch (error) {
      console.error(
        "[customer-auth] password reset delivery failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return NextResponse.json(genericResponse, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
