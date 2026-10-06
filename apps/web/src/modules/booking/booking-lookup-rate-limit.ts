import { createHash } from "node:crypto";
import { getDb } from "@yatra/db/client";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (first || realIp || "unknown").slice(0, 128);
}

function lookupKey(request: Request): string {
  return createHash("sha256")
    .update(`booking-lookup:${clientAddress(request)}`)
    .digest("hex");
}

export async function consumeBookingLookupAttempt(
  request: Request,
): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const db = getDb();
  const entityId = lookupKey(request);
  const since = new Date(Date.now() - WINDOW_MS);

  await db.auditLog.create({
    data: {
      action: "BOOKING_LOOKUP_ATTEMPT",
      entityType: "BookingLookupRateLimit",
      entityId,
    },
  });

  const attempts = await db.auditLog.count({
    where: {
      action: "BOOKING_LOOKUP_ATTEMPT",
      entityType: "BookingLookupRateLimit",
      entityId,
      createdAt: { gte: since },
    },
  });

  return {
    allowed: attempts <= MAX_ATTEMPTS,
    retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
  };
}
