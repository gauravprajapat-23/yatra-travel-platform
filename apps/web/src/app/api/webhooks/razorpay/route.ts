import { createHash } from "node:crypto";
import { getDb } from "@yatra/db/client";
import { verifyRazorpayWebhookSignature } from "@yatra/providers/payments/razorpay-signature";
import { NextResponse } from "next/server";
import { processRazorpayWebhookEvent } from "@/modules/payments/razorpay-webhook-processor";

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
    const event = await db.paymentWebhookEvent.create({
      data: {
        provider: "RAZORPAY",
        dedupeKey: eventKey,
        eventType,
        payload: JSON.parse(rawBody),
        signatureVerifiedAt: new Date(),
      },
    });

    const result = await processRazorpayWebhookEvent({
      webhookEventId: event.id,
      eventType,
      payload,
    });

    if (!result.processed) {
      return NextResponse.json(
        {
          received: true,
          processed: false,
          retryable: true,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { received: true, duplicate: false, processed: true },
      { status: 202 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existing = await db.paymentWebhookEvent.findUnique({
        where: {
          provider_dedupeKey: {
            provider: "RAZORPAY",
            dedupeKey: eventKey,
          },
        },
      });

      if (!existing) {
        return NextResponse.json(
          { error: { code: "WEBHOOK_DEDUPE_LOOKUP_FAILED" } },
          { status: 500 },
        );
      }

      const result = await processRazorpayWebhookEvent({
        webhookEventId: existing.id,
        eventType: existing.eventType,
        payload: existing.payload,
      });

      if (!result.processed) {
        return NextResponse.json(
          {
            received: true,
            duplicate: true,
            processed: false,
            retryable: true,
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { received: true, duplicate: true, processed: true },
        { status: 200 },
      );
    }

    throw error;
  }
}
