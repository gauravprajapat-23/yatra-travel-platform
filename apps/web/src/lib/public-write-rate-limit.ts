import { createHash } from "node:crypto";
import { getDb } from "@yatra/db/client";

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (first || realIp || "unknown").slice(0, 128);
}

function key(scope: string, request: Request): string {
  return createHash("sha256")
    .update(`${scope}:${clientAddress(request)}`)
    .digest("hex");
}

export async function consumePublicWriteAttempt(input: {
  request: Request;
  scope: string;
  maxAttempts: number;
  windowMs: number;
}): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  if (
    input.maxAttempts < 1 ||
    input.windowMs < 1_000 ||
    input.scope.length < 2 ||
    input.scope.length > 80
  ) {
    throw new Error("Invalid public write rate-limit configuration.");
  }

  const db = getDb();
  const entityId = key(input.scope, input.request);
  const action = `PUBLIC_WRITE_RATE_${input.scope.toUpperCase()}`;
  const since = new Date(Date.now() - input.windowMs);

  await db.auditLog.create({
    data: {
      action,
      entityType: "PublicWriteRateLimit",
      entityId,
    },
  });

  const attempts = await db.auditLog.count({
    where: {
      action,
      entityType: "PublicWriteRateLimit",
      entityId,
      createdAt: { gte: since },
    },
  });

  return {
    allowed: attempts <= input.maxAttempts,
    retryAfterSeconds: Math.ceil(input.windowMs / 1000),
  };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
    retryAfterSeconds,
  };
}
