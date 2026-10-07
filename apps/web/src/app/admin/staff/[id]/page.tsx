import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import {
  hasPermission,
  type RoleKey,
} from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import {
  AdminActionForm,
  type AdminActionState,
} from "@/components/admin-action-form";
import { AdminCheckbox, AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import {
  adminRoleKeys,
  isAdminRole,
  isStaffStatus,
  staffStatuses,
  updateStaffAccess,
  revokeStaffSessions,
  renewStaffInvite,
  revokeStaffInvite,
} from "@/modules/staff/staff-management-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "ACTIVE") return "green";
  if (status === "INVITED") return "orange";
  if (status === "SUSPENDED" || status === "DISABLED") return "red";
  return "gray";
}

function roleLabel(role: RoleKey): string {
  return role.replaceAll("_", " ");
}

export default async function StaffDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "staff.manage")) redirect("/admin");

  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const activeTab = ["overview", "access", "sessions"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
  const db = getDb();

  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { role: true },
      },
      staffInvite: {
        select: {
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
      },
      sessions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          revokedAt: true,
          lastSeenAt: true,
        },
      },
    },
  });

  if (!user) notFound();

  const currentRoles = user.roles
    .map((entry) => entry.role.key as RoleKey)
    .filter((role) => role !== "CUSTOMER");

  if (currentRoles.length === 0) notFound();

  const targetUserId = user.id;
  const isSelf = targetUserId === session.userId;

  async function revokeSessions() {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "staff.manage")) {
      redirect("/admin");
    }

    await revokeStaffSessions({
      targetUserId,
      actorUserId: currentSession.userId,
    });

    revalidatePath(`/admin/staff/${targetUserId}`);
  }

  async function regenerateInvite(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "staff.manage")) {
      redirect("/admin");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!appUrl) {
      return {
        status: "error",
        message:
          "NEXT_PUBLIC_APP_URL must be configured before an invite link can be generated.",
      };
    }

    const expiresInHours = Number(formData.get("expiresInHours") ?? 48);

    try {
      const result = await renewStaffInvite({
        targetUserId,
        actorUserId: currentSession.userId,
        expiresInHours,
      });

      const inviteUrl =
        `${appUrl.replace(/\/$/, "")}/admin/invite/${encodeURIComponent(result.token)}`;

      revalidatePath(`/admin/staff/${targetUserId}`);
      revalidatePath("/admin/staff");

      return {
        status: "success",
        message:
          "Replacement invite generated. The previous invite link is no longer valid.",
        details: {
          label: "Replacement staff invite link",
          value: inviteUrl,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to regenerate staff invite.",
      };
    }
  }

  async function cancelInvite() {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "staff.manage")) {
      redirect("/admin");
    }

    await revokeStaffInvite({
      targetUserId,
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/staff");
    redirect("/admin/staff");
  }

  async function saveAccess(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "staff.manage")) {
      redirect("/admin");
    }

    const status = String(formData.get("status") ?? "");
    if (!isStaffStatus(status)) {
      throw new Error("Invalid staff status.");
    }

    const roleValues = formData
      .getAll("roles")
      .map((value) => String(value))
      .filter(isAdminRole);

    await updateStaffAccess({
      targetUserId,
      actorUserId: currentSession.userId,
      status,
      roles: roleValues,
    });

    revalidatePath("/admin/staff");
    revalidatePath(`/admin/staff/${targetUserId}`);
  }

  const activeSessions = user.sessions.filter(
    (item) => !item.revokedAt && item.expiresAt > new Date(),
  ).length;

  const editableStatuses =
    user.status === "INVITED"
      ? staffStatuses.filter((status) =>
          ["INVITED", "DISABLED"].includes(status),
        )
      : staffStatuses.filter((status) => status !== "INVITED");

  return (
    <AdminShell
      active="Staff / Roles"
      title={user.name ?? user.email}
      subtitle={user.email}
      actions={
        <Link className="admin-secondary-button" href="/admin/staff">
          ← Staff
        </Link>
      }
    >
      <AdminEditorTabs
        basePath={`/admin/staff/${targetUserId}`}
        active={activeTab}
        tabs={[
          { key: "overview", label: "Overview", description: "Account status" },
          { key: "access", label: "Roles & Status", description: "RBAC access" },
          { key: "sessions", label: "Sessions", description: "Active login sessions" },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>Account</h2>
              <StatusPill tone={tone(user.status)}>
                {user.status.replaceAll("_", " ")}
              </StatusPill>
            </div>

            <dl>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Name</dt><dd>{user.name ?? "Not set"}</dd></div>
              <div><dt>Roles</dt><dd>{currentRoles.map(roleLabel).join(", ")}</dd></div>
              <div><dt>Last Login</dt><dd>{user.lastLoginAt?.toLocaleString("en-IN") ?? "Never"}</dd></div>
              <div><dt>Active Sessions</dt><dd>{activeSessions}</dd></div>
              <div><dt>Created</dt><dd>{user.createdAt.toLocaleString("en-IN")}</dd></div>
              {user.status === "INVITED" ? (
                <div>
                  <dt>Invite expiry</dt>
                  <dd>
                    {user.staffInvite?.expiresAt.toLocaleString("en-IN") ??
                      "Invite link needs regeneration"}
                  </dd>
                </div>
              ) : null}
            </dl>

            {user.status === "INVITED" ? (
              <AdminActionForm action={regenerateInvite}>
                <AdminFormGrid columns={1}>
                  <AdminField
                    label="Replacement invite expiry"
                    htmlFor="replacementInviteExpiry"
                    hint="Generating a new link invalidates the previous token."
                  >
                    <select
                      id="replacementInviteExpiry"
                      name="expiresInHours"
                      defaultValue="48"
                    >
                      <option value="24">24 hours</option>
                      <option value="48">48 hours</option>
                      <option value="72">72 hours</option>
                      <option value="168">7 days</option>
                    </select>
                  </AdminField>
                </AdminFormGrid>

                <div className="admin-form-actions__buttons">
                  <AdminSubmitButton
                    label="Regenerate Invite Link"
                    pendingLabel="Generating Invite…"
                  />
                </div>
              </AdminActionForm>
            ) : null}

            {user.status === "INVITED" ? (
              <form action={cancelInvite}>
                <AdminSubmitButton
                  className="admin-danger-button"
                  label="Cancel Invite & Remove Pending Account"
                  pendingLabel="Cancelling Invite…"
                />
              </form>
            ) : null}

            {isSelf ? (
              <p>
                You are editing your own account. Self-disable is blocked to
                prevent accidental lockout.
              </p>
            ) : activeSessions > 0 ? (
              <form action={revokeSessions}>
                <button className="admin-danger-button" type="submit">
                  Revoke All Active Sessions
                </button>
              </form>
            ) : (
              <p>No active sessions to revoke.</p>
            )}
          </section>
        ) : null}

        {activeTab === "access" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Roles & Status</h2>

            <form action={saveAccess}>
              <AdminFormGrid columns={1}>
                <AdminField label="Account status" htmlFor="staffStatus" required>
                  <select
                    id="staffStatus"
                    name="status"
                    defaultValue={user.status}
                  >
                    {editableStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </AdminFormGrid>

              <div className="admin-checkbox-grid">
                {adminRoleKeys.map((role) => (
                  <AdminCheckbox
                    key={role}
                    name="roles"
                    value={role}
                    defaultChecked={currentRoles.includes(role)}
                    label={roleLabel(role)}
                    description="Grant this admin role to the staff account."
                  />
                ))}
              </div>

              <p>
                Reducing another user&apos;s access revokes their active
                sessions. The last active SUPER ADMIN cannot be removed or
                disabled.
              </p>

              <AdminSubmitButton
                label="Save Access"
                pendingLabel="Saving Access…"
              />
            </form>
          </section>
        ) : null}

        {activeTab === "sessions" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <div>
                <h2>Recent Sessions</h2>
                <p>Latest 20 sessions recorded for this staff account.</p>
              </div>
              <span>{activeSessions} active</span>
            </div>

            {user.sessions.length === 0 ? (
              <p>No sessions recorded.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Last Seen</th>
                    <th>Expires</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {user.sessions.map((item) => (
                    <tr key={item.id}>
                      <td>{item.createdAt.toLocaleString("en-IN")}</td>
                      <td>{item.lastSeenAt?.toLocaleString("en-IN") ?? "—"}</td>
                      <td>{item.expiresAt.toLocaleString("en-IN")}</td>
                      <td>
                        {item.revokedAt
                          ? "Revoked"
                          : item.expiresAt <= new Date()
                            ? "Expired"
                            : "Active"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!isSelf && activeSessions > 0 ? (
              <form action={revokeSessions}>
                <button className="admin-danger-button" type="submit">
                  Revoke All Active Sessions
                </button>
              </form>
            ) : null}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
