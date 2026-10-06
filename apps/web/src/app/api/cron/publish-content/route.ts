import { NextResponse } from "next/server";
import { publishDueScheduledContent } from "@/modules/content/scheduled-publication-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized cron request." } },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "DATABASE_URL is not configured.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await publishDueScheduledContent(new Date());

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error(
      "[content-cron] scheduled publication failed",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      {
        error: {
          code: "SCHEDULED_PUBLICATION_FAILED",
          message: "Unable to publish scheduled content.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Use authenticated POST.",
      },
    },
    {
      status: 405,
      headers: {
        Allow: "POST",
        "Cache-Control": "no-store",
      },
    },
  );
}
