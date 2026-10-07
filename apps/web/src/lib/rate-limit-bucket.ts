import { getDb } from "@yatra/db/client";

type BucketRow = {
  count: number;
  windowStartedAt: Date;
};

export async function consumeRateLimitBucket(input: {
  key: string;
  maxAttempts: number;
  windowMs: number;
}): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
  count: number;
}> {
  if (
    input.key.length < 8 ||
    input.key.length > 128 ||
    input.maxAttempts < 1 ||
    input.windowMs < 1_000
  ) {
    throw new Error("Invalid rate-limit bucket configuration.");
  }

  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - input.windowMs);

  const rows = await db.$queryRaw<BucketRow[]>`
    INSERT INTO "RateLimitBucket" (
      "key",
      "windowStartedAt",
      "count",
      "updatedAt"
    )
    VALUES (
      ${input.key},
      ${now},
      1,
      ${now}
    )
    ON CONFLICT ("key")
    DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStartedAt" <= ${cutoff}
          THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "RateLimitBucket"."windowStartedAt" <= ${cutoff}
          THEN ${now}
        ELSE "RateLimitBucket"."windowStartedAt"
      END,
      "updatedAt" = ${now}
    RETURNING
      "count",
      "windowStartedAt"
  `;

  const bucket = rows[0];
  if (!bucket) {
    throw new Error("Rate-limit bucket update failed.");
  }

  const windowEndsAt = bucket.windowStartedAt.getTime() + input.windowMs;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowEndsAt - now.getTime()) / 1000),
  );

  return {
    allowed: bucket.count <= input.maxAttempts,
    retryAfterSeconds,
    count: bucket.count,
  };
}
