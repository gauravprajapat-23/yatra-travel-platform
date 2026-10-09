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
import {
  formatIstDateTime,
  parseIstDateTimeLocal,
} from "@/lib/admin/datetime";
import {
  cancelCrmFollowUp,
  completeCrmFollowUp,
  createCrmFollowUp,
  createCrmInteraction,
  crmInteractionDirections,
  crmInteractionTypes,
  type CrmInteractionDirectionValue,
  type CrmInteractionTypeValue,
} from "@/modules/crm/crm-service";

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
  const activeTab = ["overview", "trip", "crm", "status"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
  const db = getDb();

  const lead = await db.lead.findUnique({
    where: { reference },
    include: {
      crmInteractions: {
        orderBy: { occurredAt: "desc" },
        take: 50,
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      },
      crmFollowUps: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 50,
        include: {
          assignedTo: { select: { name: true, email: true } },
          createdBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!lead) notFound();

  const leadId = lead.id;
  const leadReference = lead.reference;
  const leadStatus = lead.status;

  async function addInteraction(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "crm.write")) {
      redirect("/admin/leads");
    }

    const type = String(formData.get("type") ?? "") as CrmInteractionTypeValue;
    const direction = String(
      formData.get("direction") ?? "",
    ) as CrmInteractionDirectionValue;

    if (!(crmInteractionTypes as readonly string[]).includes(type)) {
      return { status: "error", message: "Select a valid interaction type." };
    }
    if (!(crmInteractionDirections as readonly string[]).includes(direction)) {
      return { status: "error", message: "Select a valid interaction direction." };
    }

    try {
      await createCrmInteraction({
        subject: { leadId },
        type,
        direction,
        subjectLine: String(formData.get("subject") ?? ""),
        body: String(formData.get("body") ?? ""),
        actorUserId: currentSession.userId,
      });
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to add CRM interaction.",
      };
    }

    revalidatePath(`/admin/leads/${leadReference}`);
    return { status: "success", message: "Interaction added." };
  }

  async function addFollowUp(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "crm.write")) {
      redirect("/admin/leads");
    }

    try {
      const dueAt = parseIstDateTimeLocal(formData.get("dueAt"));
      if (!dueAt) throw new Error("Follow-up due date is required.");

      await createCrmFollowUp({
        subject: { leadId },
        title: String(formData.get("title") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        dueAt,
        assignedToUserId: currentSession.userId,
        actorUserId: currentSession.userId,
      });
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error ? error.message : "Unable to create follow-up.",
      };
    }

    revalidatePath(`/admin/leads/${leadReference}`);
    return { status: "success", message: "Follow-up created." };
  }

  async function completeFollowUp(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "crm.write")) {
      redirect("/admin/leads");
    }
    await completeCrmFollowUp({
      taskId: String(formData.get("taskId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/leads/${leadReference}`);
  }

  async function cancelFollowUp(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "crm.write")) {
      redirect("/admin/leads");
    }
    await cancelCrmFollowUp({
      taskId: String(formData.get("taskId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/leads/${leadReference}`);
  }

  async function updateLeadStatus(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "crm.write")) {
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
      const actionDb = getDb();
      await actionDb.$transaction([
        actionDb.lead.update({
          where: { id: leadId },
          data: { status },
        }),
        actionDb.auditLog.create({
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
      subtitle={`${lead.type.replaceAll("_", " ")} enquiry · created ${formatIstDateTime(lead.createdAt)}`}
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
            key: "crm",
            label: "CRM",
            description: "Interactions & follow-ups",
            badge: String(
              lead.crmFollowUps.filter((item) => item.status === "OPEN").length,
            ),
            badgeTone: lead.crmFollowUps.some(
              (item) => item.status === "OPEN" && item.dueAt < new Date(),
            )
              ? "warning"
              : "neutral",
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
              <div><dt>Updated</dt><dd>{formatIstDateTime(lead.updatedAt)}</dd></div>
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

        {activeTab === "crm" ? (
          <>
            <section className="admin-panel admin-detail-card">
              <div className="admin-panel-heading">
                <h2>Interaction History</h2>
                <span>{lead.crmInteractions.length} recent</span>
              </div>
              {lead.crmInteractions.length === 0 ? (
                <p>No CRM interactions recorded yet.</p>
              ) : (
                <div className="admin-card-body">
                  {lead.crmInteractions.map((interaction) => (
                    <article key={interaction.id}>
                      <strong>
                        {interaction.type} · {interaction.direction}
                      </strong>
                      <small>
                        {formatIstDateTime(interaction.occurredAt)}
                        {interaction.createdBy
                          ? ` · ${interaction.createdBy.name ?? interaction.createdBy.email}`
                          : ""}
                      </small>
                      {interaction.subject ? <h3>{interaction.subject}</h3> : null}
                      <p>{interaction.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {hasPermission(session.roles, "crm.write") ? (
              <section className="admin-panel admin-detail-card">
                <div className="admin-panel-heading">
                  <h2>Log Interaction</h2>
                </div>
                <AdminActionForm action={addInteraction}>
                  <AdminField label="Type" htmlFor="crmInteractionType">
                    <select
                      id="crmInteractionType"
                      name="type"
                      defaultValue="NOTE"
                    >
                      {crmInteractionTypes.map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Direction" htmlFor="crmDirection">
                    <select
                      id="crmDirection"
                      name="direction"
                      defaultValue="INTERNAL"
                    >
                      {crmInteractionDirections.map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField label="Subject" htmlFor="crmSubject">
                    <input id="crmSubject" name="subject" maxLength={200} />
                  </AdminField>
                  <AdminField label="Notes" htmlFor="crmBody">
                    <textarea
                      id="crmBody"
                      name="body"
                      rows={5}
                      maxLength={5000}
                      required
                    />
                  </AdminField>
                  <AdminSubmitButton
                    label="Add Interaction"
                    pendingLabel="Adding…"
                  />
                </AdminActionForm>
              </section>
            ) : null}

            <section className="admin-panel admin-detail-card">
              <div className="admin-panel-heading">
                <h2>Follow-ups</h2>
                <span>
                  {lead.crmFollowUps.filter((item) => item.status === "OPEN").length} open
                </span>
              </div>
              {lead.crmFollowUps.length === 0 ? (
                <p>No follow-up tasks yet.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Due</th>
                        <th>Assigned</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lead.crmFollowUps.map((task) => (
                        <tr key={task.id}>
                          <td>
                            <strong>{task.title}</strong>
                            {task.notes ? <><br /><small>{task.notes}</small></> : null}
                          </td>
                          <td>{formatIstDateTime(task.dueAt)}</td>
                          <td>
                            {task.assignedTo?.name ??
                              task.assignedTo?.email ??
                              "Unassigned"}
                          </td>
                          <td>{task.status}</td>
                          <td>
                            {task.status === "OPEN" &&
                            hasPermission(session.roles, "crm.write") ? (
                              <div className="admin-inline-actions">
                                <form action={completeFollowUp}>
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <AdminSubmitButton
                                    label="Complete"
                                    pendingLabel="Completing…"
                                  />
                                </form>
                                <form action={cancelFollowUp}>
                                  <input type="hidden" name="taskId" value={task.id} />
                                  <AdminSubmitButton
                                    label="Cancel"
                                    pendingLabel="Cancelling…"
                                  />
                                </form>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {hasPermission(session.roles, "crm.write") ? (
              <section className="admin-panel admin-detail-card">
                <div className="admin-panel-heading">
                  <h2>Schedule Follow-up</h2>
                </div>
                <AdminActionForm action={addFollowUp}>
                  <AdminField label="Task" htmlFor="crmFollowUpTitle">
                    <input
                      id="crmFollowUpTitle"
                      name="title"
                      minLength={2}
                      maxLength={200}
                      required
                    />
                  </AdminField>
                  <AdminField label="Due at (IST)" htmlFor="crmFollowUpDueAt">
                    <input
                      id="crmFollowUpDueAt"
                      name="dueAt"
                      type="datetime-local"
                      required
                    />
                  </AdminField>
                  <AdminField label="Notes" htmlFor="crmFollowUpNotes">
                    <textarea
                      id="crmFollowUpNotes"
                      name="notes"
                      rows={4}
                      maxLength={5000}
                    />
                  </AdminField>
                  <AdminSubmitButton
                    label="Create Follow-up"
                    pendingLabel="Creating…"
                  />
                </AdminActionForm>
              </section>
            ) : null}
          </>
        ) : null}

        {activeTab === "status" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>Update Status</h2>
              <StatusPill tone={tone(lead.status)}>
                {lead.status.replaceAll("_", " ")}
              </StatusPill>
            </div>
            {hasPermission(session.roles, "crm.write") ? (
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
