import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@yatra/db/client";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

type AuthActionPurpose = "EMAIL_VERIFICATION" | "PASSWORD_RESET";

function hashAuthActionToken(token: string): string {
  return createHash("sha256")
    .update(`auth-action:${token}`)
    .digest("hex");
}

function tokenTtlMs(purpose: AuthActionPurpose): number {
  return purpose === "EMAIL_VERIFICATION"
    ? EMAIL_VERIFICATION_TTL_MS
    : PASSWORD_RESET_TTL_MS;
}

export async function issueAuthActionToken(input: {
  userId: string;
  purpose: AuthActionPurpose;
}) {
  const db = getDb();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashAuthActionToken(rawToken);
  const expiresAt = new Date(Date.now() + tokenTtlMs(input.purpose));

  const token = await db.$transaction(async (tx) => {
    await tx.authActionToken.updateMany({
      where: {
        userId: input.userId,
        purpose: input.purpose,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });

    return tx.authActionToken.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash,
        expiresAt,
      },
      select: {
        id: true,
        userId: true,
        purpose: true,
        expiresAt: true,
      },
    });
  });

  return {
    ...token,
    rawToken,
  };
}

export async function consumeAuthActionToken(input: {
  rawToken: string;
  purpose: AuthActionPurpose;
}) {
  const db = getDb();
  const tokenHash = hashAuthActionToken(input.rawToken);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const token = await tx.authActionToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        purpose: true,
        expiresAt: true,
        consumedAt: true,
        revokedAt: true,
      },
    });

    if (
      !token ||
      token.purpose !== input.purpose ||
      token.consumedAt ||
      token.revokedAt ||
      token.expiresAt <= now
    ) {
      return null;
    }

    const claimed = await tx.authActionToken.updateMany({
      where: {
        id: token.id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (claimed.count !== 1) return null;

    return {
      id: token.id,
      userId: token.userId,
      purpose: token.purpose,
      consumedAt: now,
    };
  });
}

export async function revokeAuthActionTokens(input: {
  userId: string;
  purpose?: AuthActionPurpose;
}) {
  const db = getDb();

  return db.authActionToken.updateMany({
    where: {
      userId: input.userId,
      ...(input.purpose ? { purpose: input.purpose } : {}),
      consumedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}
