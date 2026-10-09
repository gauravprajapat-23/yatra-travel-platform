import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import {
  previewPromotionForQuote,
  PromotionPreviewError,
} from "@/modules/promotions/promotion-preview-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreviewBody = {
  quoteType?: unknown;
  quoteId?: unknown;
  code?: unknown;
  guestEmail?: unknown;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

export async function POST(request: Request) {
  if (process.env.PROMOTION_APPLY_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "PROMOTION_APPLY_DISABLED",
          message: "Promotion application is not enabled yet.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rateLimit = await consumePublicWriteAttempt({
    request,
    scope: "promotion_preview",
    maxAttempts: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(rateLimitedResponse(rateLimit.retryAfterSeconds), {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    });
  }

  let body: PreviewBody;
  try {
    body = await readJsonBody<PreviewBody>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
      return NextResponse.json(
        { error: { code: error.code, message: "Invalid request." } },
        { status: error.httpStatus, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }

  const quoteType =
    body.quoteType === "CAR" || body.quoteType === "PACKAGE"
      ? body.quoteType
      : null;
  const quoteId = text(body.quoteId, 128);
  const code = text(body.code, 32);
  const guestEmail = text(body.guestEmail, 320);

  if (!quoteType || !quoteId || !code) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PROMOTION_PREVIEW",
          message: "Quote type, quote ID and promotion code are required.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const customerSession = await getCustomerSession();

  if (!customerSession && !guestEmail) {
    return NextResponse.json(
      {
        error: {
          code: "PROMOTION_IDENTITY_REQUIRED",
          message: "Email is required to validate this promotion.",
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await previewPromotionForQuote({
      quoteType,
      quoteId,
      code,
      identity: customerSession
        ? { customerUserId: customerSession.userId }
        : { guestEmail: guestEmail! },
    });

    return NextResponse.json(
      {
        promotion: {
          id: result.promotionId,
          code: result.code,
          name: result.name,
        },
        quote: {
          id: result.quoteId,
          currency: result.currency,
          subtotalMinor: result.subtotalMinor.toString(),
          discountMinor: result.discountMinor.toString(),
          taxMinor: result.taxMinor.toString(),
          totalMinor: result.totalMinor.toString(),
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PromotionPreviewError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: error.httpStatus,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    console.error(
      "[promotions] preview failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error: {
          code: "PROMOTION_PREVIEW_FAILED",
          message: "Unable to validate promotion right now.",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
