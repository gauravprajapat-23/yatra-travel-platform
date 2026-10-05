import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createAdminSession } from "@/lib/auth/session";
import { hasPermission, type RoleKey } from "@yatra/domain/auth/permissions";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  const db = getDb();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? normalizeEmail(String((body as { email: unknown }).email))
      : "";
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String((body as { password: unknown }).password)
      : "";

  if (!email || !password || email.length > 320 || password.length > 256) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { emailNormalized: email },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  const genericError = { error: "Invalid email or password." };

  if (!user || !user.passwordHash || user.status !== "ACTIVE") {
    await db.auditLog.create({
      data: {
        action: "ADMIN_LOGIN_FAILED",
        entityType: "User",
        metadata: { email },
      },
    }).catch(() => undefined);
    return NextResponse.json(genericError, { status: 401 });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  const roles = user.roles.map((entry) => entry.role.key) as RoleKey[];
  const hasAdminAccess = hasPermission(roles, "admin.access");

  if (!passwordOk || !hasAdminAccess) {
    await db.auditLog.create({
      data: {
        actorUserId: passwordOk ? user.id : null,
        action: "ADMIN_LOGIN_FAILED",
        entityType: "User",
        entityId: passwordOk ? user.id : null,
        metadata: { email },
      },
    }).catch(() => undefined);
    return NextResponse.json(genericError, { status: 401 });
  }

  const expiresAt = await createAdminSession(user.id);

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    db.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "ADMIN_LOGIN_SUCCEEDED",
        entityType: "User",
        entityId: user.id,
        metadata: { roles },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
    },
    expiresAt: expiresAt.toISOString(),
  });
}
