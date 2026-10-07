import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminCheckbox,
  AdminCheckboxGrid,
  AdminField,
  AdminFormAsideCard,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import {
  AdminActionForm,
  type AdminActionState,
} from "@/components/admin-action-form";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { requireAdminSession } from "@/lib/auth/session";
import {
  adminRoleKeys,
  createStaffInvite,
  isAdminRole,
} from "@/modules/staff/staff-management-service";

export const dynamic = "force-dynamic";

function roleLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function NewStaffPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "staff.manage")) redirect("/admin");

  async function invite(
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
          "NEXT_PUBLIC_APP_URL must be configured before staff invites can be generated.",
      };
    }

    const roles = formData
      .getAll("roles")
      .map((value) => String(value))
      .filter(isAdminRole);

    const expiresInHours = Number(formData.get("expiresInHours") ?? 48);

    try {
      const result = await createStaffInvite({
        email: String(formData.get("email") ?? ""),
        name: String(formData.get("name") ?? ""),
        roles,
        actorUserId: currentSession.userId,
        expiresInHours,
      });

      const inviteUrl =
        `${appUrl.replace(/\/$/, "")}/admin/invite/${encodeURIComponent(result.token)}`;

      revalidatePath("/admin/staff");

      return {
        status: "success",
        message:
          "Staff invite created. Copy the one-time link now; only its hash is stored.",
        details: {
          label: "One-time staff invite link",
          value: inviteUrl,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create staff invite.",
      };
    }
  }

  return (
    <AdminShell
      active="Staff / Roles"
      title="Invite Staff"
      subtitle="Create a role-scoped admin account with an expiring one-time password setup link."
      actions={
        <Link className="admin-secondary-button" href="/admin/staff">
          ← Staff
        </Link>
      }
    >
      <div className="admin-form-layout">
        <AdminActionForm action={invite} className="admin-form">
          <AdminFormSection
            title="Staff identity"
            description="The invite is bound to this email address and cannot be used for an existing account."
            badge="Required"
          >
            <AdminFormGrid columns={2}>
              <AdminField label="Full name" htmlFor="staffInviteName" required>
                <input
                  id="staffInviteName"
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Operations Manager"
                />
              </AdminField>

              <AdminField label="Email" htmlFor="staffInviteEmail" required>
                <input
                  id="staffInviteEmail"
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="manager@example.com"
                />
              </AdminField>

              <AdminField
                label="Invite expiry"
                htmlFor="staffInviteExpiry"
                hint="Shorter expiry is safer. The link can be regenerated if needed."
              >
                <select
                  id="staffInviteExpiry"
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
          </AdminFormSection>

          <AdminFormSection
            title="Admin roles"
            description="Assign only the permissions needed for this staff member's responsibilities."
          >
            <AdminCheckboxGrid>
              {adminRoleKeys.map((role) => (
                <AdminCheckbox
                  key={role}
                  name="roles"
                  value={role}
                  label={roleLabel(role)}
                  description="Grant this admin role after invite acceptance."
                />
              ))}
            </AdminCheckboxGrid>

            <AdminFormCallout tone="warning" title="Least privilege">
              Avoid SUPER ADMIN unless the user must manage every administrative
              permission and critical account controls.
            </AdminFormCallout>
          </AdminFormSection>

          <footer className="admin-form-actions">
            <div className="admin-form-actions__meta">
              <small>
                The account remains INVITED and cannot sign in until password
                setup is completed.
              </small>
            </div>
            <div className="admin-form-actions__buttons">
              <Link className="admin-secondary-button" href="/admin/staff">
                Cancel
              </Link>
              <AdminSubmitButton
                label="Create Staff Invite"
                pendingLabel="Creating Invite…"
              />
            </div>
          </footer>
        </AdminActionForm>

        <aside className="admin-form-aside">
          <AdminFormAsideCard title="Invite security">
            <ul>
              <li>The raw token is shown once and never stored.</li>
              <li>Only a SHA-256 token hash is persisted.</li>
              <li>The user cannot log in while status is INVITED.</li>
              <li>Acceptance activates the account atomically.</li>
            </ul>
          </AdminFormAsideCard>

          <AdminFormAsideCard title="Existing email">
            <p>
              Existing customer or staff accounts are rejected instead of being
              silently elevated into an admin role.
            </p>
          </AdminFormAsideCard>
        </aside>
      </div>
    </AdminShell>
  );
}
