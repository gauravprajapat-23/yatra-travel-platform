import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  if (status === "SCHEDULED") return "blue";
  return "gray";
}

export default async function PackagesPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "package.read")) redirect("/admin");

  const db = getDb();

  const [packages, total, published, drafts, scheduled] = await Promise.all([
    db.tourPackage.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        priceOptions: {
          where: { isActive: true },
          orderBy: { amountMinor: "asc" },
        },
        destinations: {
          include: { destination: { select: { name: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
      take: 100,
    }),
    db.tourPackage.count(),
    db.tourPackage.count({ where: { status: "PUBLISHED" } }),
    db.tourPackage.count({ where: { status: { in: ["DRAFT", "REVIEW"] } } }),
    db.tourPackage.count({ where: { status: "SCHEDULED" } }),
  ]);

  const rows = packages.map((pkg) => {
    const firstPrice = pkg.priceOptions[0];
    return [
      pkg.title,
      pkg.destinations.map((item) => item.destination.name).join(", ") || "—",
      `${pkg.durationDays}D / ${pkg.durationNights}N`,
      firstPrice ? `From ${money(firstPrice.amountMinor, firstPrice.currency)}` : "Quote only",
      <StatusPill key={pkg.id} tone={tone(pkg.status)}>
        {pkg.status.replaceAll("_", " ")}
      </StatusPill>,
      pkg.publishedAt?.toLocaleDateString("en-IN") ?? "—",
      pkg.slug,
    ];
  });

  return (
    <AdminTablePage
      active="Tours & Packages"
      title="Packages"
      subtitle="Live tour package catalog, pricing and publication state."
      metrics={[
        { label: "Total Packages", value: total.toString(), meta: "all records", tone: "orange" },
        { label: "Published", value: published.toString(), meta: "visible publicly", tone: "green" },
        { label: "Draft / Review", value: drafts.toString(), meta: "not public", tone: "blue" },
        { label: "Scheduled", value: scheduled.toString(), meta: "future publication", tone: "orange" },
      ]}
      filters={["Latest 100"]}
      columns={["Package", "Destinations", "Duration", "Price", "Status", "Published", "Slug"]}
      rows={rows}
    />
  );
}
