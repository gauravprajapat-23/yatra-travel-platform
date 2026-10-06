import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";
import { hasPermission, type RoleKey } from "@yatra/domain/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databasePing: false,
    adminLookup: false,
    adminActive: false,
    passwordHashPresent: false,
    roleRelationReadable: false,
    hasAdminAccess: false,
    sessionTableReadable: false,
    auditTableReadable: false,
    failedStage: null as string | null,
  };

  if (!process.env.DATABASE_URL) {
    result.failedStage = "DATABASE_URL";
    return NextResponse.json(result, { status: 503 });
  }

  try {
    const db = getDb();

    try {
      await db.$queryRawUnsafe("SELECT 1");
      result.databasePing = true;
    } catch {
      result.failedStage = "DATABASE_PING";
      return NextResponse.json(result, { status: 503 });
    }

    let user: Awaited<ReturnType<typeof db.user.findUnique>>;
    try {
      user = await db.user.findUnique({
        where: { emailNormalized: "admin@yatra.com" },
        include: {
          roles: {
            include: { role: true },
          },
        },
      });
      result.adminLookup = Boolean(user);
    } catch (error) {
      console.error("[admin-auth-diagnostic] user lookup failed", error);
      result.failedStage = "ADMIN_LOOKUP";
      return NextResponse.json(result, { status: 503 });
    }

    if (!user) {
      result.failedStage = "ADMIN_NOT_FOUND";
      return NextResponse.json(result, { status: 404 });
    }

    result.adminActive = user.status === "ACTIVE";
    result.passwordHashPresent = Boolean(user.passwordHash);

    try {
      const roles = user.roles.map((entry) => entry.role.key) as RoleKey[];
      result.roleRelationReadable = true;
      result.hasAdminAccess = hasPermission(roles, "admin.access");
    } catch (error) {
      console.error("[admin-auth-diagnostic] role evaluation failed", error);
      result.failedStage = "ROLE_RELATION";
      return NextResponse.json(result, { status: 503 });
    }

    try {
      await db.session.count({ where: { userId: user.id } });
      result.sessionTableReadable = true;
    } catch (error) {
      console.error("[admin-auth-diagnostic] session table read failed", error);
      result.failedStage = "SESSION_TABLE";
      return NextResponse.json(result, { status: 503 });
    }

    try {
      await db.auditLog.count({ where: { actorUserId: user.id } });
      result.auditTableReadable = true;
    } catch (error) {
      console.error("[admin-auth-diagnostic] audit table read failed", error);
      result.failedStage = "AUDIT_TABLE";
      return NextResponse.json(result, { status: 503 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin-auth-diagnostic] runtime failure", error);
    result.failedStage = "RUNTIME";
    return NextResponse.json(result, { status: 503 });
  }
}
