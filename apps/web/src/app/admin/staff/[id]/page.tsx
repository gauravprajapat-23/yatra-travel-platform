import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import {
  hasPermission,
  type RoleKey,
} from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  adminRoleKeys,
  isAdminRole,
  isStaffStatus,
  staffStatuses,
  updateStaffAccess,
  revokeStaffSessions,
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
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "staff.manage")) redirect("/admin");

  const { id } = await params;
  const db = getDb();

  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { role: true },
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
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>Account</h2>
            <StatusPill tone={tone(user.status)}>
              {user.status.replaceAll("_", " ")}
            </StatusPill>
          </div>

          <dl>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{user.name ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Last Login</dt>
              <dd>{user.lastLoginAt?.toLocaleString("en-IN") ?? "Never"}</dd>
            </div>
            <div>
              <dt>Active Sessions</dt>
              <dd>{activeSessions}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{user.createdAt.toLocaleString("en-IN")}</dd>
            </div>
          </dl>

          {isSelf ? (
            <p>
              You are editing your own account. Self-disable is blocked to prevent
              accidental lockout.
            </p>
          ) : (
            <form action={revokeSessions}>
              <button className="admin-danger-button" type="submit">
                Revoke All Active Sessions
              </button>
            </form>
          )}
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Roles & Status</h2>

          <form action={saveAccess}>
            <label>
              Account status
              <select name="status" defaultValue={user.status}>
                {staffStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend>Admin roles</legend>
              {adminRoleKeys.map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    name="roles"
                    value={role}
                    defaultChecked={currentRoles.includes(role)}
                  />
                  {roleLabel(role)}
                </label>
              ))}
            </fieldset>

            <p>
              Reducing another user&apos;s access revokes their active sessions.
              The last active SUPER ADMIN cannot be removed or disabled.
            </p>

            <button className="admin-primary-button" type="submit">
              Save Access
            </button>
          </form>
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Recent Sessions</h2>
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
        </section>
      </div>
    </AdminShell>
  );
}
