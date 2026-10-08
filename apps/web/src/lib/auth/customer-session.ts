import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission, type RoleKey } from "@yatra/domain/auth/permissions";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function allowInsecureCiCustomerCookie(): boolean {
  if (
    process.env.CI !== "true" ||
    process.env.E2E_ALLOW_INSECURE_CUSTOMER_COOKIE !== "true"
  ) {
    return false;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return false;

  try {
    const url = new URL(appUrl);
    return (
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

const SECURE_CUSTOMER_COOKIE =
  process.env.NODE_ENV === "production" && !allowInsecureCiCustomerCookie();

export const CUSTOMER_SESSION_COOKIE = SECURE_CUSTOMER_COOKIE
  ? "__Host-yatra_customer"
  : "yatra_customer";

function hashCustomerSessionToken(token: string): string {
  return createHash("sha256")
    .update(`customer-session:${token}`)
    .digest("hex");
}

function requestIpHash(request: Request | undefined): string | null {
  if (!request) return null;

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;

  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const address = (first || realIp || "").slice(0, 128);
  if (!address) return null;

  return createHmac("sha256", secret)
    .update(`customer-session-ip:${address}`)
    .digest("hex");
}

export async function createCustomerSession(
  userId: string,
  request?: Request,
) {
  const db = getDb();
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      tokenHash: hashCustomerSessionToken(rawToken),
      userId,
      expiresAt,
      lastSeenAt: new Date(),
      ipHash: requestIpHash(request),
      userAgent:
        request?.headers.get("user-agent")?.trim().slice(0, 500) || null,
    },
  });

  const jar = await cookies();
  jar.set(CUSTOMER_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: SECURE_CUSTOMER_COOKIE,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return expiresAt;
}

export async function revokeCurrentCustomerSession() {
  const jar = await cookies();
  const rawToken = jar.get(CUSTOMER_SESSION_COOKIE)?.value;

  if (rawToken) {
    const db = getDb();
    await db.session.updateMany({
      where: {
        tokenHash: hashCustomerSessionToken(rawToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  jar.delete(CUSTOMER_SESSION_COOKIE);
}

export async function getCustomerSession() {
  const jar = await cookies();
  const rawToken = jar.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const db = getDb();
  const session = await db.session.findUnique({
    where: { tokenHash: hashCustomerSessionToken(rawToken) },
    include: {
      user: {
        include: {
          roles: {
            include: { role: true },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }
  if (
    session.user.status !== "ACTIVE" ||
    !session.user.emailVerifiedAt
  ) {
    return null;
  }

  const roles = session.user.roles.map((entry) => entry.role.key) as RoleKey[];
  if (!hasPermission(roles, "customer.self.read")) return null;

  await db.session
    .update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    roles,
    expiresAt: session.expiresAt,
  };
}

export async function requireCustomerSession() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  return session;
}
