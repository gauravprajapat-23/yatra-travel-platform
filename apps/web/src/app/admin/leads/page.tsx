import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminTablePage, StatusPill } from "@/components/admin-table-page";
import { requireAdminSession } from "@/lib/auth/session";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "QUALIFIED" || status === "CLOSED") return "green";
  if (status === "IN_PROGRESS") return "blue";
  if (status === "SPAM") return "red";
  if (status === "NEW") return "orange";
  return "gray";
}

function interest(type: string, tripData: unknown): string {
  if (type === "CONTACT") return "General enquiry";
  if (typeof tripData === "object" && tripData !== null) {
    const data = tripData as Record<string, unknown>;
    for (const key of ["destination", "package", "route", "tripType"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "Custom trip";
}

export default async function LeadsPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "lead.read")) redirect("/admin");

  const db = getDb();

  const [leads, total, newCount, inProgressCount, qualifiedCount] =
    await Promise.all([
      db.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.lead.count(),
      db.lead.count({ where: { status: "NEW" } }),
      db.lead.count({ where: { status: "IN_PROGRESS" } }),
      db.lead.count({ where: { status: "QUALIFIED" } }),
    ]);

  const rows = leads.map((lead) => [
    lead.name,
    lead.phone ?? lead.email,
    lead.sourcePath ?? "Website",
    interest(lead.type, lead.tripData),
    <StatusPill key={`${lead.id}-status`} tone={tone(lead.status)}>
      {lead.status.replaceAll("_", " ")}
    </StatusPill>,
    lead.createdAt.toLocaleDateString("en-IN"),
    lead.reference,
  ]);

  return (
    <AdminTablePage
      active="Enquiries / Leads"
      title="Leads & Enquiries"
      subtitle="Live contact and custom-trip enquiries captured from the public website."
      metrics={[
        { label: "Total Leads", value: total.toString(), meta: "all time", tone: "blue" },
        { label: "New Leads", value: newCount.toString(), meta: "needs review", tone: "orange" },
        { label: "In Progress", value: inProgressCount.toString(), meta: "currently active", tone: "blue" },
        { label: "Qualified", value: qualifiedCount.toString(), meta: "qualified opportunities", tone: "green" },
      ]}
      filters={["Latest 100"]}
      columns={["Name", "Contact", "Source", "Interest", "Status", "Created", "Reference"]}
      rows={rows}
    />
  );
}
