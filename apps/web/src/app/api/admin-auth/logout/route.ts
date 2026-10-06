import { NextResponse } from "next/server";
import { revokeCurrentAdminSession } from "@/lib/auth/session";

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
      {
        error: {
          code: "INVALID_ORIGIN",
          message: "Invalid request origin.",
        },
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  await revokeCurrentAdminSession();

  return NextResponse.redirect(
    new URL("/admin/login", request.url),
    303,
  );
}
