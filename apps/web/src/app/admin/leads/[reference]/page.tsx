import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminActionForm, type AdminActionState } from "@/components/admin-action-form";
import { AdminField } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const leadStatuses = ["NEW", "IN_PROGRESS", "QUALIFIED", "CLOSED", "SPAM"] as const;
type LeadStatusValue = (typeof leadStatuses)[number];

function isLeadStatus(value: string): value is LeadStatusValue {
  return (leadStatuses as readonly string[]).includes(value);
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "QUALIFIED" || status === "CLOSED") return "green";
  if (status === "IN_PROGRESS") return "blue";
  if (status === "SPAM") return "red";
  if (status === "NEW") return "orange";
  return "gray";
}

function renderTripData(value: unknown): Array<[string, string]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => ["string", "number", "boolean"].includes(typeof entry))
    .slice(0, 12)
    .map(([key, entry]) => [key, String(entry)]);
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "lead.read")) redirect("/admin");

  const { reference: rawReference } = await params;
  const { tab: requestedTab } = await searchParams;
  const reference = rawReference.trim().toUpperCase();
  const activeTab = ["overview", "trip", "status"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
  const db = getDb();

  const lead = await db.lead.findUnique({ where: { reference } });
  if (!lead) notFound();

  const leadId = lead.id;
  const leadReference = lead.reference;
  const leadStatus = lead.status;

  async function updateLeadStatus(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "lead.write")) {
      redirect("/admin/leads");
    }

    const status = String(formData.get("status") ?? "");
    if (!isLeadStatus(status)) {
      return {
        status: "error",
        message: "Select a valid lead status.",
      };
    }

    const previousStatus = leadStatus;

    try {
      await db.$transaction([
        db.lead.update({
          where: { id: leadId },
          data: { status },
        }),
        db.auditLog.create({
          data: {
            actorUserId: currentSession.userId,
            action: "LEAD_STATUS_CHANGED",
            entityType: "Lead",
            entityId: leadId,
            metadata: {
              reference: leadReference,
              fromStatus: previousStatus,
              toStatus: status,
            },
          },
        }),
      ]);
    } catch {
      return {
        status: "error",
        message: "Unable to update the lead status. Please try again.",
      };
    }

    revalidatePath(`/admin/leads/${leadReference}`);
    revalidatePath("/admin/leads");

    return {
      status: "success",
      message: "Lead status updated.",
    };
  }

  const tripData = renderTripData(lead.tripData);

  return (
    <AdminShell
      active="Enquiries / Leads"
      title={`Lead ${leadReference}`}
      subtitle={`${lead.type.replaceAll("_", " ")} enquiry · created ${lead.createdAt.toLocaleString("en-IN")}`}
      actions={<Link className="admin-secondary-button" href="/admin/leads">← All Leads</Link>}
    >
      <AdminEditorTabs
        basePath={`/admin/leads/${leadReference}`}
        active={activeTab}
        tabs={[
          {
            key: "overview",
            label: "Overview",
            description: "Contact & message",
            badge: lead.status.replaceAll("_", " "),
          },
          {
            key: "trip",
            label: "Trip Data",
            description: "Captured enquiry details",
            badge: String(tripData.length),
            badgeTone: tripData.length > 0 ? "success" : "neutral",
          },
          {
            key: "status",
            label: "Status",
            description: "Qualification workflow",
            badge: lead.status.replaceAll("_", " "),
            badgeTone:
              lead.status === "QUALIFIED" || lead.status === "CLOSED"
                ? "success"
                : lead.status === "SPAM"
                  ? "warning"
                  : "neutral",
          },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>Lead Details</h2>
              <StatusPill tone={tone(lead.status)}>
                {lead.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
            <dl>
              <div><dt>Name</dt><dd>{lead.name}</dd></div>
              <div><dt>Email</dt><dd>{lead.email}</dd></div>
              <div><dt>Phone</dt><dd>{lead.phone ?? "Not provided"}</dd></div>
              <div><dt>Source</dt><dd>{lead.sourcePath ?? "Website"}</dd></div>
              <div><dt>Type</dt><dd>{lead.type.replaceAll("_", " ")}</dd></div>
              <div><dt>Updated</dt><dd>{lead.updatedAt.toLocaleString("en-IN")}</dd></div>
            </dl>
            {lead.message ? (
              <>
                <h3>Message</h3>
                <p>{lead.message}</p>
              </>
            ) : null}
          </section>
        ) : null}

        {activeTab === "trip" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Trip Data</h2>
            {tripData.length === 0 ? (
              <p>No structured trip details were captured.</p>
            ) : (
              <dl>
                {tripData.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ) : null}

        {activeTab === "status" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>Update Status</h2>
              <StatusPill tone={tone(lead.status)}>
                {lead.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
            {hasPermission(session.roles, "lead.write") ? (
              <AdminActionForm action={updateLeadStatus}>
                <AdminField
                  label="Lead status"
                  htmlFor="leadStatus"
                  hint="Move the enquiry through qualification, closure or spam review."
                >
                  <select
                    id="leadStatus"
                    name="status"
                    defaultValue={lead.status}
                  >
                    {leadStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminSubmitButton
                  label="Save Lead Status"
                  pendingLabel="Saving Status…"
                />
              </AdminActionForm>
            ) : (
              <p>Your role has read-only access to leads.</p>
            )}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
