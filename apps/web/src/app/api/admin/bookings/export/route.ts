import { NextResponse } from "next/server";
import { getDb, Prisma } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import {
  bookingStatuses,
  type BookingStatus,
} from "@yatra/domain/booking/status-machine";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function isBookingStatus(value: string): value is BookingStatus {
  return (bookingStatuses as readonly string[]).includes(value);
}

function parseDateStart(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateEnd(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T23:59:59.999+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "booking.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const statusValue = (url.searchParams.get("status") ?? "").trim();
  const status = isBookingStatus(statusValue) ? statusValue : null;
  const typeValue = url.searchParams.get("type");
  const type = typeValue === "CAR" || typeValue === "PACKAGE" ? typeValue : "ALL";
  const assignmentValue = url.searchParams.get("assignment");
  const assignment =
    assignmentValue === "ASSIGNED" || assignmentValue === "UNASSIGNED"
      ? assignmentValue
      : "ALL";
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const fromDate = parseDateStart(from);
  const toDate = parseDateEnd(to);
  const travelRange =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const carWhere: Prisma.CarBookingWhereInput = {
    ...(status ? { status } : {}),
    ...(travelRange ? { startsAt: travelRange } : {}),
    ...(assignment === "ASSIGNED"
      ? { selectedVehicleId: { not: null }, assignedDriverId: { not: null } }
      : {}),
    ...((assignment === "UNASSIGNED" || q)
      ? {
          AND: [
            ...(assignment === "UNASSIGNED"
              ? [{ OR: [{ selectedVehicleId: null }, { assignedDriverId: null }] }]
              : []),
            ...(q
              ? [{
                  OR: [
                    { reference: { contains: q, mode: "insensitive" as const } },
                    { guestName: { contains: q, mode: "insensitive" as const } },
                    { guestEmail: { contains: q, mode: "insensitive" as const } },
                    { originText: { contains: q, mode: "insensitive" as const } },
                    { destinationText: { contains: q, mode: "insensitive" as const } },
                  ],
                }]
              : []),
          ],
        }
      : {}),
  };

  const packageWhere: Prisma.PackageBookingWhereInput = {
    ...(status ? { status } : {}),
    ...(travelRange ? { travelStartAt: travelRange } : {}),
    ...(q
      ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { guestName: { contains: q, mode: "insensitive" } },
            { guestEmail: { contains: q, mode: "insensitive" } },
            { package: { title: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const db = getDb();
  const [cars, packages] = await Promise.all([
    type === "PACKAGE"
      ? Promise.resolve([])
      : db.carBooking.findMany({
          where: carWhere,
          orderBy: { startsAt: "asc" },
          take: 5000,
          select: {
            reference: true,
            status: true,
            guestName: true,
            guestEmail: true,
            originText: true,
            destinationText: true,
            startsAt: true,
            endsAt: true,
            travellers: true,
            currency: true,
            subtotalMinor: true,
            discountMinor: true,
            totalMinor: true,
            promotion: { select: { code: true } },
            vehicleClass: { select: { name: true } },
            selectedVehicle: { select: { displayName: true, registrationNumber: true } },
            assignedDriver: { select: { displayName: true } },
          },
        }),
    type === "CAR" || assignment !== "ALL"
      ? Promise.resolve([])
      : db.packageBooking.findMany({
          where: packageWhere,
          orderBy: { travelStartAt: "asc" },
          take: 5000,
          select: {
            reference: true,
            status: true,
            guestName: true,
            guestEmail: true,
            travelStartAt: true,
            travellers: true,
            currency: true,
            subtotalMinor: true,
            discountMinor: true,
            totalMinor: true,
            promotion: { select: { code: true } },
            package: { select: { title: true } },
          },
        }),
  ]);

  const rows = [
    [
      "Type",
      "Reference",
      "Status",
      "Customer",
      "Email",
      "Route / Package",
      "Travel Start",
      "Travel End",
      "Travellers",
      "Vehicle Class",
      "Vehicle",
      "Driver",
      "Currency",
      "Subtotal Minor",
      "Discount Minor",
      "Promotion Code",
      "Total Minor",
    ],
    ...cars.map((booking) => [
      "CAR",
      booking.reference,
      booking.status,
      booking.guestName ?? "",
      booking.guestEmail ?? "",
      `${booking.originText} → ${booking.destinationText}`,
      booking.startsAt.toISOString(),
      booking.endsAt?.toISOString() ?? "",
      booking.travellers,
      booking.vehicleClass.name,
      booking.selectedVehicle
        ? `${booking.selectedVehicle.displayName} · ${booking.selectedVehicle.registrationNumber}`
        : "",
      booking.assignedDriver?.displayName ?? "",
      booking.currency,
      booking.subtotalMinor.toString(),
      booking.discountMinor.toString(),
      booking.promotion?.code ?? "",
      booking.totalMinor.toString(),
    ]),
    ...packages.map((booking) => [
      "PACKAGE",
      booking.reference,
      booking.status,
      booking.guestName ?? "",
      booking.guestEmail ?? "",
      booking.package.title,
      booking.travelStartAt.toISOString(),
      "",
      booking.travellers,
      "",
      "",
      "",
      booking.currency,
      booking.subtotalMinor.toString(),
      booking.discountMinor.toString(),
      booking.promotion?.code ?? "",
      booking.totalMinor.toString(),
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="yatra-bookings-${stamp}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
