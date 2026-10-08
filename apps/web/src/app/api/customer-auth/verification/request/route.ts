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

type ResendBody = {
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
  message:
    "If an unverified customer account exists for that email, a new verification link will be sent.",
};

export async function POST(request: Request) {
  if (process.env.CUSTOMER_AUTH_WRITE_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "VERIFICATION_DELIVERY_DISABLED",
          message: "Email verification delivery is not enabled yet.",
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
      "[customer-auth] verification provider unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error: {
          code: "VERIFICATION_DELIVERY_UNAVAILABLE",
          message: "Email verification is temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const limit = await consumePublicWriteAttempt({
    request,
    scope: "customer-verification-resend",
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

  let body: ResendBody;
  try {
    body = await readJsonBody<ResendBody>(request, 2048);
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
      emailVerifiedAt: null,
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
        purpose: "EMAIL_VERIFICATION",
        provider,
      });
    } catch (error) {
      console.error(
        "[customer-auth] verification resend failed",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return NextResponse.json(genericResponse, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
