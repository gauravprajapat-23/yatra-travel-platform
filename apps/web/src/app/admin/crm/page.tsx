import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { requireAdminSession } from "@/lib/auth/session";
import { formatIstDateTime } from "@/lib/admin/datetime";
import { reassignCrmFollowUp } from "@/modules/crm/crm-service";

export const dynamic = "force-dynamic";

function followUpTone(
  status: string,
  dueAt: Date,
  now: Date,
): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "COMPLETED") return "green";
  if (status === "CANCELLED") return "gray";
  if (dueAt < now) return "red";
  return "orange";
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "crm.read")) redirect("/admin");

  const params = await searchParams;
  const requestedView = String(params.view ?? "ALL").toUpperCase();
  const view = ["ALL", "MINE", "OVERDUE", "DUE_SOON"].includes(requestedView)
    ? requestedView
    : "ALL";

  const db = getDb();
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const followUpWhere = {
    status: "OPEN" as const,
    ...(view === "MINE" ? { assignedToUserId: session.userId } : {}),
    ...(view === "OVERDUE" ? { dueAt: { lt: now } } : {}),
    ...(view === "DUE_SOON"
      ? { dueAt: { gte: now, lte: next24Hours } }
      : {}),
  };

  const [
    openFollowUps,
    overdueCount,
    dueSoonCount,
    recentInteractions,
    staffUsers,
  ] = await Promise.all([
    db.crmFollowUpTask.findMany({
      where: followUpWhere,
      orderBy: { dueAt: "asc" },
      take: 50,
      include: {
        lead: { select: { reference: true, name: true } },
        customer: { select: { emailNormalized: true, name: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    db.crmFollowUpTask.count({
      where: {
        status: "OPEN",
        dueAt: { lt: now },
      },
    }),
    db.crmFollowUpTask.count({
      where: {
        status: "OPEN",
        dueAt: { gte: now, lte: next24Hours },
      },
    }),
    db.crmInteraction.findMany({
      orderBy: { occurredAt: "desc" },
      take: 30,
      include: {
        lead: { select: { reference: true, name: true } },
        customer: { select: { emailNormalized: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    hasPermission(session.roles, "crm.write")
      ? db.user.findMany({
          where: {
            status: "ACTIVE",
            roles: {
              some: {
                role: { key: { not: "CUSTOMER" } },
              },
            },
          },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: { id: true, name: true, email: true },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  async function reassignFollowUp(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "crm.write")) {
      redirect("/admin/crm");
    }

    const taskId = String(formData.get("taskId") ?? "").trim();
    const assignedToUserId =
      String(formData.get("assignedToUserId") ?? "").trim() || null;

    if (!taskId) throw new Error("Follow-up task is required.");

    await reassignCrmFollowUp({
      taskId,
      assignedToUserId,
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/crm");
  }

  function subjectLabel(input: {
    lead: { reference: string; name: string } | null;
    customer: { emailNormalized: string; name: string | null } | null;
    customerEmailNormalized: string | null;
  }) {
    if (input.lead) {
      return {
        label: `${input.lead.name} · ${input.lead.reference}`,
        href: `/admin/leads/${input.lead.reference}?tab=crm`,
      };
    }

    const email =
      input.customer?.emailNormalized ?? input.customerEmailNormalized;
    return {
      label: input.customer?.name
        ? `${input.customer.name} · ${email}`
        : email ?? "Customer",
      href: email
        ? `/admin/customers/${encodeURIComponent(email)}`
        : "/admin/customers",
    };
  }

  return (
    <AdminShell
      active="CRM"
      title="CRM Follow-ups"
      subtitle="Internal customer and lead interaction history with auditable follow-up tasks."
    >
      <nav className="admin-filter-tabs" aria-label="CRM follow-up filters">
        {[
          ["ALL", "All Open"],
          ["MINE", "My Follow-ups"],
          ["OVERDUE", "Overdue"],
          ["DUE_SOON", "Due Next 24h"],
        ].map(([key, label]) => (
          <Link
            key={key}
            className={
              view === key
                ? "admin-filter-tab admin-filter-tab--active"
                : "admin-filter-tab"
            }
            href={key === "ALL" ? "/admin/crm" : `/admin/crm?view=${key}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="admin-metric-grid">
        <article className="admin-metric">
          <small>{view === "ALL" ? "Open Follow-ups" : "Matching Follow-ups"}</small>
          <strong>{openFollowUps.length}</strong>
        </article>
        <article className="admin-metric">
          <small>Overdue</small>
          <strong>{overdueCount}</strong>
        </article>
        <article className="admin-metric">
          <small>Due Next 24h</small>
          <strong>{dueSoonCount}</strong>
        </article>
        <article className="admin-metric">
          <small>Recent Interactions</small>
          <strong>{recentInteractions.length}</strong>
        </article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>
            {view === "MINE"
              ? "My Follow-ups"
              : view === "OVERDUE"
                ? "Overdue Follow-ups"
                : view === "DUE_SOON"
                  ? "Due Next 24 Hours"
                  : "Open Follow-ups"}
          </h2>
          <span>Earliest due first</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Task</th>
                <th>Due</th>
                <th>Assigned</th>
                <th>Status</th>
                <th>Ownership</th>
              </tr>
            </thead>
            <tbody>
              {openFollowUps.length === 0 ? (
                <tr>
                  <td colSpan={6}>No open CRM follow-ups.</td>
                </tr>
              ) : (
                openFollowUps.map((task) => {
                  const subject = subjectLabel(task);
                  return (
                    <tr key={task.id}>
                      <td>
                        <Link href={subject.href}>{subject.label}</Link>
                      </td>
                      <td>
                        <strong>{task.title}</strong>
                        {task.notes ? (
                          <>
                            <br />
                            <small>{task.notes}</small>
                          </>
                        ) : null}
                      </td>
                      <td>{formatIstDateTime(task.dueAt)}</td>
                      <td>
                        {task.assignedTo?.name ??
                          task.assignedTo?.email ??
                          "Unassigned"}
                      </td>
                      <td>
                        <StatusPill
                          tone={followUpTone(task.status, task.dueAt, now)}
                        >
                          {task.dueAt < now ? "OVERDUE" : task.status}
                        </StatusPill>
                      </td>
                      <td>
                        {hasPermission(session.roles, "crm.write") ? (
                          <form action={reassignFollowUp} className="admin-inline-actions">
                            <input type="hidden" name="taskId" value={task.id} />
                            <select
                              name="assignedToUserId"
                              defaultValue={task.assignedToUserId ?? ""}
                              aria-label={`Assign ${task.title}`}
                            >
                              <option value="">Unassigned</option>
                              {staffUsers.map((staff) => (
                                <option key={staff.id} value={staff.id}>
                                  {staff.name ?? staff.email}
                                </option>
                              ))}
                            </select>
                            <AdminSubmitButton
                              label="Assign"
                              pendingLabel="Assigning…"
                            />
                          </form>
                        ) : (
                          "Read only"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Recent Interactions</h2>
          <span>Latest 30</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Summary</th>
                <th>Logged by</th>
              </tr>
            </thead>
            <tbody>
              {recentInteractions.length === 0 ? (
                <tr>
                  <td colSpan={6}>No CRM interactions recorded yet.</td>
                </tr>
              ) : (
                recentInteractions.map((interaction) => {
                  const subject = subjectLabel(interaction);
                  return (
                    <tr key={interaction.id}>
                      <td>{formatIstDateTime(interaction.occurredAt)}</td>
                      <td>
                        <Link href={subject.href}>{subject.label}</Link>
                      </td>
                      <td>{interaction.type}</td>
                      <td>{interaction.direction}</td>
                      <td>
                        {interaction.subject ??
                          interaction.body.slice(0, 120)}
                      </td>
                      <td>
                        {interaction.createdBy?.name ??
                          interaction.createdBy?.email ??
                          "System"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
