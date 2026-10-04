import { createHash } from "node:crypto";
import { getDb } from "@yatra/db/client";
import { verifyRazorpayWebhookSignature } from "@yatra/providers/payments/razorpay-signature";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function dedupeKey(rawBody: string, eventHeader: string | null): string {
  if (eventHeader?.trim()) {
    return eventHeader.trim();
  }

  return createHash("sha256").update(rawBody).digest("hex");
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: { code: "WEBHOOK_NOT_CONFIGURED" } },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: { code: "MISSING_SIGNATURE" } },
      { status: 401 },
    );
  }

  const rawBody = await request.text();

  if (
    !verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      webhookSecret,
    })
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_SIGNATURE" } },
      { status: 401 },
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_PAYLOAD" } },
      { status: 400 },
    );
  }

  const eventType =
    typeof payload === "object" &&
    payload !== null &&
    "event" in payload &&
    typeof payload.event === "string"
      ? payload.event
      : "unknown";

  const eventKey = dedupeKey(
    rawBody,
    request.headers.get("x-razorpay-event-id"),
  );

  const db = getDb();

  try {
    await db.paymentWebhookEvent.create({
      data: {
        provider: "RAZORPAY",
        dedupeKey: eventKey,
        eventType,
        payload: JSON.parse(rawBody),
        signatureVerifiedAt: new Date(),
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { received: true, duplicate: true },
        { status: 200 },
      );
    }

    throw error;
  }

  return NextResponse.json(
    { received: true, duplicate: false },
    { status: 202 },
  );
}
