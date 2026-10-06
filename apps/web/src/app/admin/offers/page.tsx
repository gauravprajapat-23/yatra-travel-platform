import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function money(minor: bigint | null, currency: string): string {
  if (minor === null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "DRAFT") return "orange";
  if (status === "INACTIVE") return "gray";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

export default async function OffersPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "settings.manage")) redirect("/admin");

  const db = getDb();
  const now = new Date();

  const [rules, total, active, drafts, expiredActive] = await Promise.all([
    db.pricingRule.findMany({
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
      include: {
        vehicleClass: { select: { name: true } },
      },
      take: 100,
    }),
    db.pricingRule.count(),
    db.pricingRule.count({ where: { status: "ACTIVE" } }),
    db.pricingRule.count({ where: { status: "DRAFT" } }),
    db.pricingRule.count({
      where: {
        status: "ACTIVE",
        activeTo: { lt: now },
      },
    }),
  ]);

  const rows = rules.map((rule) => [
    rule.name,
    rule.vehicleClass.name,
    rule.tripType.replaceAll("_", " "),
    rule.basis.replaceAll("_", " "),
    rule.basis === "FIXED"
      ? money(rule.baseAmountMinor, rule.currency)
      : rule.basis === "PER_KM"
        ? `${money(rule.perKmMinor, rule.currency)} / km`
        : "Quote only",
    rule.activeFrom?.toLocaleDateString("en-IN") ?? "Immediate",
    rule.activeTo?.toLocaleDateString("en-IN") ?? "No expiry",
    <StatusPill key={rule.id} tone={tone(rule.status)}>
      {rule.status.replaceAll("_", " ")}
    </StatusPill>,
  ]);

  return (
    <AdminTablePage
      active="Offers"
      title="Pricing Rules / Offers"
      subtitle="Live server-side pricing rules. Coupon codes are not enabled until a dedicated promotion engine is implemented."
      metrics={[
        { label: "Pricing Rules", value: total.toString(), meta: "live DB records", tone: "blue" },
        { label: "Active Rules", value: active.toString(), meta: "eligible for quoting", tone: "green" },
        { label: "Draft Rules", value: drafts.toString(), meta: "not public", tone: "orange" },
        { label: "Expired Active", value: expiredActive.toString(), meta: "requires review", tone: expiredActive ? "red" : "green" },
      ]}
      filters={["Latest 100"]}
      columns={["Rule", "Vehicle Class", "Trip Type", "Basis", "Rate", "Starts", "Ends", "Status"]}
      rows={rows}
    />
  );
}
