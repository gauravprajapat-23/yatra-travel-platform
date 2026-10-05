import { NextResponse } from "next/server";
import { revokeCurrentAdminSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await revokeCurrentAdminSession();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
