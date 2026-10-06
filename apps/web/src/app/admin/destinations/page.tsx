import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "red";
  return "gray";
}

export default async function DestinationsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const [destinations, total, published, drafts, featured] = await Promise.all([
    db.destination.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.destination.count(),
    db.destination.count({ where: { status: "PUBLISHED" } }),
    db.destination.count({ where: { status: { in: ["DRAFT", "REVIEW"] } } }),
    db.destination.count({ where: { isFeatured: true } }),
  ]);

  const rows = destinations.map((destination) => [
    destination.name,
    destination.slug,
    destination.kind.replaceAll("_", " "),
    destination.isFeatured ? "Featured" : "—",
    destination.seoTitle ? "SEO ready" : "SEO missing",
    <StatusPill key={destination.id} tone={tone(destination.status)}>
      {destination.status.replaceAll("_", " ")}
    </StatusPill>,
    destination.updatedAt.toLocaleDateString("en-IN"),
  ]);

  return (
    <AdminTablePage
      active="Destinations"
      title="Destinations"
      subtitle="Live destination content and publication state from Neon."
      metrics={[
        { label: "Total Destinations", value: total.toString(), meta: "all records", tone: "green" },
        { label: "Published", value: published.toString(), meta: "visible publicly", tone: "green" },
        { label: "Draft / Review", value: drafts.toString(), meta: "work in progress", tone: "orange" },
        { label: "Featured", value: featured.toString(), meta: "highlighted destinations", tone: "blue" },
      ]}
      filters={["Latest 100"]}
      columns={["Destination", "Slug", "Kind", "Featured", "SEO", "Status", "Updated"]}
      rows={rows}
    />
  );
}
