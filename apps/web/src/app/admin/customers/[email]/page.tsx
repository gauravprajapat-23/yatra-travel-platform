import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import {
  AdminActionForm,
  type AdminActionState,
} from "@/components/admin-action-form";
import { AdminField } from "@/components/admin-form";
import { AdminSubmitButton } from "@/components/admin-submit-button";
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

function money(minor: bigint, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

function formatCurrencyTotals(totals: ReadonlyMap<string, bigint>): string {
  const values = [...totals.entries()]
    .filter(([, amount]) => amount !== 0n)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => money(amount, currency));

  return values.length > 0 ? values.join(" · ") : "—";
}

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (["CONFIRMED", "COMPLETED"].includes(status)) return "green";
  if (["PENDING_PAYMENT", "PENDING_REVIEW", "REFUND_PENDING"].includes(status)) return "orange";
  if (["CANCELLED", "FAILED", "REFUNDED", "EXPIRED"].includes(status)) return "red";
  if (["DRIVER_ASSIGNED", "IN_PROGRESS"].includes(status)) return "blue";
  return "gray";
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "customer.read")) redirect("/admin");

  const { email: rawEmail } = await params;
  let email: string;
  try {
    email = decodeURIComponent(rawEmail).trim().toLowerCase();
  } catch {
    notFound();
  }

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    notFound();
  }

  const db = getDb();

  const customerUser = await db.user.findUnique({
    where: { emailNormalized: email },
    select: { id: true, name: true, email: true },
  });

  const customerWhere = customerUser
    ? {
        OR: [
          { customerUserId: customerUser.id },
          { customerUserId: null, guestEmail: email },
        ],
      }
    : { guestEmail: email };

  const crmSubject = customerUser
    ? { customerUserId: customerUser.id as string }
    : { customerEmailNormalized: email };

  const [cars, packages, crmInteractions, crmFollowUps] = await Promise.all([
    db.carBooking.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      select: {
        reference: true,
        guestName: true,
        originText: true,
        destinationText: true,
        startsAt: true,
        status: true,
        currency: true,
        totalMinor: true,
        createdAt: true,
      },
    }),
    db.packageBooking.findMany({
      where: customerWhere,
      orderBy: { createdAt: "desc" },
      select: {
        reference: true,
        guestName: true,
        travelStartAt: true,
        status: true,
        currency: true,
        totalMinor: true,
        createdAt: true,
        package: { select: { title: true } },
      },
    }),
    db.crmInteraction.findMany({
      where: customerUser
        ? { customerUserId: customerUser.id }
        : { customerEmailNormalized: email },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: {
        createdBy: { select: { name: true, email: true } },
      },
    }),
    db.crmFollowUpTask.findMany({
      where: customerUser
        ? { customerUserId: customerUser.id }
        : { customerEmailNormalized: email },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 50,
      include: {
        assignedTo: { select: { name: true, email: true } },
      },
    }),
  ]);

  if (cars.length === 0 && packages.length === 0) notFound();

  const bookings = [
    ...cars.map((booking) => ({
      reference: booking.reference,
      name: booking.guestName,
      title: `${booking.originText} → ${booking.destinationText}`,
      startsAt: booking.startsAt,
      status: booking.status,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
      createdAt: booking.createdAt,
    })),
    ...packages.map((booking) => ({
      reference: booking.reference,
      name: booking.guestName,
      title: booking.package.title,
      startsAt: booking.travelStartAt,
      status: booking.status,
      currency: booking.currency,
      totalMinor: booking.totalMinor,
      createdAt: booking.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const lifetimeByCurrency = new Map<string, bigint>();
  for (const booking of bookings) {
    lifetimeByCurrency.set(
      booking.currency,
      (lifetimeByCurrency.get(booking.currency) ?? 0n) + booking.totalMinor,
    );
  }
  const latest = bookings[0];

  async function addInteraction(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "customer.write")) {
      redirect("/admin/customers");
    }

    const type = String(formData.get("type") ?? "") as CrmInteractionTypeValue;
    const direction = String(
      formData.get("direction") ?? "",
    ) as CrmInteractionDirectionValue;

    if (!(crmInteractionTypes as readonly string[]).includes(type)) {
      return { status: "error", message: "Select a valid interaction type." };
    }
    if (!(crmInteractionDirections as readonly string[]).includes(direction)) {
      return {
        status: "error",
        message: "Select a valid interaction direction.",
      };
    }

    try {
      await createCrmInteraction({
        subject: crmSubject,
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

    revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
    return { status: "success", message: "Interaction added." };
  }

  async function addFollowUp(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "customer.write")) {
      redirect("/admin/customers");
    }

    try {
      const dueAt = parseIstDateTimeLocal(formData.get("dueAt"));
      if (!dueAt) throw new Error("Follow-up due date is required.");

      await createCrmFollowUp({
        subject: crmSubject,
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

    revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
    return { status: "success", message: "Follow-up created." };
  }

  async function completeFollowUp(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "customer.write")) {
      redirect("/admin/customers");
    }
    await completeCrmFollowUp({
      taskId: String(formData.get("taskId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
  }

  async function cancelFollowUp(formData: FormData) {
    "use server";
    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "customer.write")) {
      redirect("/admin/customers");
    }
    await cancelCrmFollowUp({
      taskId: String(formData.get("taskId") ?? ""),
      actorUserId: currentSession.userId,
    });
    revalidatePath(`/admin/customers/${encodeURIComponent(email)}`);
  }

  return (
    <AdminShell
      active="Customers"
      title={customerUser?.name ?? latest?.name ?? "Guest Customer"}
      subtitle={customerUser ? `${customerUser.email} · registered account` : email}
      actions={<Link className="admin-secondary-button" href="/admin/customers">← All Customers</Link>}
    >
      <div className="admin-metric-grid">
        <article className="admin-metric">
          <small>Total Bookings</small>
          <strong>{bookings.length}</strong>
        </article>
        <article className="admin-metric">
          <small>Booked Value</small>
          <strong>{formatCurrencyTotals(lifetimeByCurrency)}</strong>
        </article>
        <article className="admin-metric">
          <small>Last Booking</small>
          <strong>{latest?.createdAt.toLocaleDateString("en-IN") ?? "—"}</strong>
        </article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>Booking History</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Trip / Package</th>
                <th>Travel Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.reference}>
                  <td>
                    <Link href={`/admin/bookings/${booking.reference}`}>
                      {booking.reference}
                    </Link>
                  </td>
                  <td>{booking.title}</td>
                  <td>{booking.startsAt.toLocaleDateString("en-IN")}</td>
                  <td>{money(booking.totalMinor, booking.currency)}</td>
                  <td>
                    <StatusPill tone={tone(booking.status)}>
                      {booking.status.replaceAll("_", " ")}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel admin-detail-card">
        <div className="admin-panel-heading">
          <h2>CRM Interactions</h2>
          <span>{crmInteractions.length} recent</span>
        </div>
        {crmInteractions.length === 0 ? (
          <p>No CRM interactions recorded yet.</p>
        ) : (
          <div className="admin-card-body">
            {crmInteractions.map((interaction) => (
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

      {hasPermission(session.roles, "customer.write") ? (
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Log Interaction</h2>
          </div>
          <AdminActionForm action={addInteraction}>
            <AdminField label="Type" htmlFor="customerCrmType">
              <select id="customerCrmType" name="type" defaultValue="NOTE">
                {crmInteractionTypes.map((item) => (
                  <option key={item} value={item}>
                    {item.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Direction" htmlFor="customerCrmDirection">
              <select
                id="customerCrmDirection"
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
            <AdminField label="Subject" htmlFor="customerCrmSubject">
              <input
                id="customerCrmSubject"
                name="subject"
                maxLength={200}
              />
            </AdminField>
            <AdminField label="Notes" htmlFor="customerCrmBody">
              <textarea
                id="customerCrmBody"
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

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>CRM Follow-ups</h2>
          <span>
            {crmFollowUps.filter((item) => item.status === "OPEN").length} open
          </span>
        </div>
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
              {crmFollowUps.length === 0 ? (
                <tr>
                  <td colSpan={5}>No follow-up tasks yet.</td>
                </tr>
              ) : (
                crmFollowUps.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.title}</strong>
                      {task.notes ? <><br /><small>{task.notes}</small></> : null}
                    </td>
                    <td>{formatIstDateTime(task.dueAt)}</td>
                    <td>{task.assignedTo?.name ?? task.assignedTo?.email ?? "Unassigned"}</td>
                    <td>{task.status}</td>
                    <td>
                      {task.status === "OPEN" &&
                      hasPermission(session.roles, "customer.write") ? (
                        <div className="admin-inline-actions">
                          <form action={completeFollowUp}>
                            <input type="hidden" name="taskId" value={task.id} />
                            <button className="admin-secondary-button" type="submit">
                              Complete
                            </button>
                          </form>
                          <form action={cancelFollowUp}>
                            <input type="hidden" name="taskId" value={task.id} />
                            <button className="admin-secondary-button" type="submit">
                              Cancel
                            </button>
                          </form>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {hasPermission(session.roles, "customer.write") ? (
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Schedule Follow-up</h2>
          </div>
          <AdminActionForm action={addFollowUp}>
            <AdminField label="Task" htmlFor="customerFollowUpTitle">
              <input
                id="customerFollowUpTitle"
                name="title"
                minLength={2}
                maxLength={200}
                required
              />
            </AdminField>
            <AdminField label="Due at (IST)" htmlFor="customerFollowUpDueAt">
              <input
                id="customerFollowUpDueAt"
                name="dueAt"
                type="datetime-local"
                required
              />
            </AdminField>
            <AdminField label="Notes" htmlFor="customerFollowUpNotes">
              <textarea
                id="customerFollowUpNotes"
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
    </AdminShell>
  );
}
