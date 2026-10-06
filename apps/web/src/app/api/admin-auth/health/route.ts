import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, databaseConfigured: false, databaseReachable: false },
      { status: 503 },
    );
  }

  try {
    const db = getDb();
    await db.$queryRawUnsafe("SELECT 1");
    return NextResponse.json({
      ok: true,
      databaseConfigured: true,
      databaseReachable: true,
    });
  } catch (error) {
    console.error(
      "[admin-auth] Health check database failure:",
      error instanceof Error ? error.message : "Unknown database/runtime error",
    );

    return NextResponse.json(
      { ok: false, databaseConfigured: true, databaseReachable: false },
      { status: 503 },
    );
  }
}
