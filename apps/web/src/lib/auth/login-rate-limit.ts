import { createHash } from "node:crypto";
import { getDb } from "@yatra/db/client";

const WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_IDENTITY_LIMIT = 8;
const DEFAULT_IP_LIMIT = 30;

function e2eRateLimitOverride(
  envName: "E2E_ADMIN_LOGIN_IDENTITY_LIMIT" | "E2E_ADMIN_LOGIN_IP_LIMIT",
  fallback: number,
): number {
  if (process.env.E2E_ALLOW_INSECURE_ADMIN_COOKIE !== "true") {
    return fallback;
  }

  const raw = process.env[envName]?.trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < fallback || parsed > 500) {
    return fallback;
  }

  return parsed;
}

function adminLoginLimits() {
  return {
    identity: e2eRateLimitOverride(
      "E2E_ADMIN_LOGIN_IDENTITY_LIMIT",
      DEFAULT_IDENTITY_LIMIT,
    ),
    ip: e2eRateLimitOverride(
      "E2E_ADMIN_LOGIN_IP_LIMIT",
      DEFAULT_IP_LIMIT,
    ),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (first || realIp || "unknown").slice(0, 128);
}

export function loginIdentityHash(email: string): string {
  return sha256(`admin-login-identity:${email.trim().toLowerCase()}`);
}

function loginIpHash(request: Request): string {
  return sha256(`admin-login-ip:${clientAddress(request)}`);
}

export async function consumeAdminLoginAttempt(input: {
  request: Request;
  normalizedEmail: string;
}): Promise<{
  allowed: boolean;
  retryAfterSeconds: number;
  identityHash: string;
}> {
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_MS);
  const identityHash = loginIdentityHash(input.normalizedEmail);
  const ipHash = loginIpHash(input.request);

  await db.$transaction([
    db.auditLog.create({
      data: {
        action: "ADMIN_LOGIN_RATE_IDENTITY",
        entityType: "AuthRateLimit",
        entityId: identityHash,
      },
    }),
    db.auditLog.create({
      data: {
        action: "ADMIN_LOGIN_RATE_IP",
        entityType: "AuthRateLimit",
        entityId: ipHash,
      },
    }),
  ]);

  const [identityAttempts, ipAttempts] = await Promise.all([
    db.auditLog.count({
      where: {
        action: "ADMIN_LOGIN_RATE_IDENTITY",
        entityType: "AuthRateLimit",
        entityId: identityHash,
        createdAt: { gte: since },
      },
    }),
    db.auditLog.count({
      where: {
        action: "ADMIN_LOGIN_RATE_IP",
        entityType: "AuthRateLimit",
        entityId: ipHash,
        createdAt: { gte: since },
      },
    }),
  ]);

  const limits = adminLoginLimits();

  return {
    allowed:
      identityAttempts <= limits.identity &&
      ipAttempts <= limits.ip,
    retryAfterSeconds: Math.ceil(WINDOW_MS / 1000),
    identityHash,
  };
}
