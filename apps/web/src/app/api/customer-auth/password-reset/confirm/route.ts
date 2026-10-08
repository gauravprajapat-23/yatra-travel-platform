import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import { resetCustomerPasswordWithToken } from "@/modules/notifications/auth-action-service";

export const runtime = "nodejs";

type ConfirmBody = {
  token?: unknown;
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

  const limit = await consumePublicWriteAttempt({
    request,
    scope: "customer-password-reset-confirm",
    maxAttempts: 10,
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

  let body: ConfirmBody;
  try {
    body = await readJsonBody<ConfirmBody>(request, 4096);
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
  const password = typeof body.password === "string" ? body.password : "";

  if (
    !/^[A-Za-z0-9_-]{32,128}$/.test(token) ||
    password.length < 10 ||
    password.length > 256
  ) {
    return NextResponse.json(
      {
        error: {
          code: "RESET_REQUEST_INVALID",
          message: "The reset link or password is invalid.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const passwordHash = await hashPassword(password);
  const reset = await resetCustomerPasswordWithToken({
    rawToken: token,
    passwordHash,
  });

  if (!reset) {
    return NextResponse.json(
      {
        error: {
          code: "RESET_LINK_INVALID",
          message: "This reset link is invalid or expired.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, passwordReset: true },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
