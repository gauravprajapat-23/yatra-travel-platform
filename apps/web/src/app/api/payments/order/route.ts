import { NextResponse } from "next/server";
import { JsonBodyError, readJsonBody } from "@/lib/read-json-body";
import {
  consumePublicWriteAttempt,
  rateLimitedResponse,
} from "@/lib/public-write-rate-limit";
import { cookies } from "next/headers";
import {
  CHECKOUT_SESSION_COOKIE,
  verifyCheckoutSessionToken,
} from "@/lib/checkout-session";
import {
  createPaymentOrder,
  PaymentOrderServiceError,
} from "@/modules/payments/payment-order-service";

export const dynamic = "force-dynamic";

type RequestBody = {
  bookingType?: unknown;
  bookingReference?: unknown;
};

export async function POST(request: Request) {
  const rateLimit = await consumePublicWriteAttempt({
    request,
    scope: "payment_order",
    maxAttempts: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      rateLimitedResponse(rateLimit.retryAfterSeconds),
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  if (process.env.PAYMENT_WRITE_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: {
          code: "PAYMENT_WRITE_DISABLED",
          message: "Online payment order creation is not enabled.",
        },
      },
      { status: 503 },
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();

  if (
    !idempotencyKey ||
    idempotencyKey.length < 16 ||
    idempotencyKey.length > 128
  ) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message: "A valid Idempotency-Key header is required.",
        },
      },
      { status: 400 },
    );
  }

  let body: RequestBody;
  try {
    body = await readJsonBody<RequestBody>(request, 4096);
  } catch (error) {
    if (error instanceof JsonBodyError) {
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
    throw error;
  }

  if (body.bookingType !== "CAR" && body.bookingType !== "PACKAGE") {
    return NextResponse.json(
      { error: { code: "INVALID_BOOKING_TYPE" } },
      { status: 400 },
    );
  }

  if (
    typeof body.bookingReference !== "string" ||
    body.bookingReference.trim().length === 0 ||
    body.bookingReference.length > 64
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_BOOKING_REFERENCE" } },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const checkoutSession = verifyCheckoutSessionToken(
    jar.get(CHECKOUT_SESSION_COOKIE)?.value,
  );

  const normalizedReference = body.bookingReference.trim().toUpperCase();

  if (
    !checkoutSession ||
    checkoutSession.t !== body.bookingType ||
    checkoutSession.r !== normalizedReference
  ) {
    return NextResponse.json(
      {
        error: {
          code: "CHECKOUT_SESSION_MISMATCH",
          message: "A valid checkout session is required for this booking.",
        },
      },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const result = await createPaymentOrder({
      bookingType: body.bookingType,
      bookingReference: normalizedReference,
      idempotencyKey,
    });

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PaymentOrderServiceError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.httpStatus },
      );
    }

    return NextResponse.json(
      { error: { code: "PAYMENT_ORDER_CREATE_FAILED" } },
      { status: 500 },
    );
  }
}
