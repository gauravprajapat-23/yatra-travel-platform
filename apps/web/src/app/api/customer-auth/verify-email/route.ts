import { NextResponse } from "next/server";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import { verifyCustomerEmailWithToken } from "@/modules/notifications/auth-action-service";

export const runtime = "nodejs";

type VerifyBody = {
  token?: unknown;
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

  let body: VerifyBody;
  try {
    body = await readJsonBody<VerifyBody>(request, 2048);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        { error: { code: error.code, message: "Invalid request." } },
        { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_OR_EXPIRED_TOKEN",
          message: "This verification link is invalid or has expired.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const limit = await consumePublicWriteAttempt({
    request,
    scope: "customer-email-verify",
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

  const verified = await verifyCustomerEmailWithToken(token);
  if (!verified) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_OR_EXPIRED_TOKEN",
          message: "This verification link is invalid or has expired.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Email verified. You can now sign in.",
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
