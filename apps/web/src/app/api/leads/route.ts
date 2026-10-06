import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@yatra/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LeadBody = {
  type?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  message?: unknown;
  sourcePath?: unknown;
  website?: unknown;
  trip?: unknown;
};

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v && v.length <= max ? v : null;
}

function optional(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return str(value, max);
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function leadReference(): string {
  return `LD-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function tripData(value: unknown): Record<string, string | number> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const safe: Record<string, string | number> = {};

  const fields = [
    ["from", 120],
    ["to", 120],
    ["duration", 3],
    ["travelDate", 20],
    ["travellers", 3],
    ["vehicle", 120],
  ] as const;

  for (const [field, max] of fields) {
    const raw = source[field];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      safe[field] = raw;
    } else if (typeof raw === "string" && raw.trim().length <= max) {
      safe[field] = raw.trim();
    }
  }

  return Object.keys(safe).length ? safe : undefined;
}

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();

  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    return NextResponse.json(
      { error: { code: "INVALID_IDEMPOTENCY_KEY", message: "A valid idempotency key is required." } },
      { status: 400 },
    );
  }

  let body: LeadBody;
  try {
    body = (await request.json()) as LeadBody;
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  // Honeypot: bots that fill this field get a generic success response.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true, reference: "accepted" }, { status: 202 });
  }

  const type = body.type === "CONTACT" || body.type === "CUSTOM_TRIP" ? body.type : null;
  const name = str(body.name, 120);
  const email = str(body.email, 254)?.toLowerCase() ?? null;
  const phone = optional(body.phone, 40);
  const message = optional(body.message, 2000);
  const sourcePath = optional(body.sourcePath, 200);

  if (!type || !name || !email || !validEmail(email)) {
    return NextResponse.json(
      { error: { code: "INVALID_LEAD", message: "Name, valid email and lead type are required." } },
      { status: 400 },
    );
  }

  if (type === "CONTACT" && !message) {
    return NextResponse.json(
      { error: { code: "MESSAGE_REQUIRED", message: "Please enter a message." } },
      { status: 400 },
    );
  }

  try {
    const db = getDb();

    const replay = await db.lead.findUnique({ where: { idempotencyKey } });
    if (replay) {
      return NextResponse.json({
        ok: true,
        replayed: true,
        reference: replay.reference,
        status: replay.status,
      });
    }

    const recentCount = await db.lead.count({
      where: {
        emailNormalized: email,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (recentCount >= 5) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
        { status: 429 },
      );
    }

    const lead = await db.lead.create({
      data: {
        reference: leadReference(),
        type,
        idempotencyKey,
        name,
        email,
        emailNormalized: email,
        phone,
        message,
        tripData: type === "CUSTOM_TRIP" ? tripData(body.trip) : undefined,
        sourcePath,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        replayed: false,
        reference: lead.reference,
        status: lead.status,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: { code: "LEAD_CONFLICT", message: "This request was already submitted." } },
        { status: 409 },
      );
    }

    console.error("[leads] create failed", error);
    return NextResponse.json(
      { error: { code: "LEAD_CREATE_FAILED", message: "Unable to submit your request." } },
      { status: 500 },
    );
  }
}
