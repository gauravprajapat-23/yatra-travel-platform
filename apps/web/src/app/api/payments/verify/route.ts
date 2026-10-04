import { NextResponse } from "next/server";
import {
  PaymentReconciliationError,
  reconcileVerifiedRazorpayPayment,
} from "@/modules/payments/payment-reconciliation-service";

export const dynamic = "force-dynamic";

type RequestBody = {
  paymentIntentId?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

function nonEmpty(value: unknown, maxLength = 256): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON" } },
      { status: 400 },
    );
  }

  if (!nonEmpty(body.paymentIntentId, 128)) {
    return NextResponse.json(
      { error: { code: "INVALID_PAYMENT_INTENT_ID" } },
      { status: 400 },
    );
  }

  if (!nonEmpty(body.razorpay_payment_id, 128)) {
    return NextResponse.json(
      { error: { code: "INVALID_PAYMENT_ID" } },
      { status: 400 },
    );
  }

  if (!nonEmpty(body.razorpay_signature, 256)) {
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE" } },
      { status: 400 },
    );
  }

  try {
    const result = await reconcileVerifiedRazorpayPayment({
      paymentIntentId: body.paymentIntentId.trim(),
      paymentId: body.razorpay_payment_id.trim(),
      signature: body.razorpay_signature.trim(),
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PaymentReconciliationError) {
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

    return NextResponse.json(
      { error: { code: "PAYMENT_RECONCILIATION_FAILED" } },
      { status: 500 },
    );
  }
}
