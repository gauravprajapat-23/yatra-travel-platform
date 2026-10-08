import { NextResponse } from "next/server";
import { revokeCurrentCustomerSession } from "@/lib/auth/customer-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = request.headers.get("origin");

  if (
    process.env.NODE_ENV === "production" &&
    (!appUrl ||
      !origin ||
      (() => {
        try {
          return new URL(origin).origin !== new URL(appUrl).origin;
        } catch {
          return true;
        }
      })())
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_ORIGIN" } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  await revokeCurrentCustomerSession();
  return NextResponse.redirect(new URL("/account/login", request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store" },
  });
}
