import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const enabled = process.env.PAYMENT_WRITE_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json(
      { enabled: false, error: "Online payment is not enabled." },
      { status: 503 },
    );
  }

  if (!keyId) {
    return NextResponse.json(
      { enabled: false, error: "Razorpay is not configured." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    enabled: true,
    keyId,
    mode: keyId.startsWith("rzp_live_") ? "live" : "test",
  });
}
