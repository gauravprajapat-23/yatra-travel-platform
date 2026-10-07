import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminField, AdminFormCallout } from "@/components/admin-form";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { getAdminSession } from "@/lib/auth/session";
import {
  acceptStaffInvite,
  inspectStaffInvite,
} from "@/modules/staff/staff-management-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept Staff Invite",
  robots: { index: false, follow: false },
};

export default async function StaffInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const existingSession = await getAdminSession();
  if (existingSession) redirect("/admin");

  const { token } = await params;
  const invite = await inspectStaffInvite(token);

  async function accept(formData: FormData) {
    "use server";

    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(
      formData.get("confirmPassword") ?? "",
    );

    if (password !== confirmPassword) {
      throw new Error("Password confirmation does not match.");
    }

    await acceptStaffInvite({
      token,
      password,
    });

    redirect("/admin/login?invite=accepted");
  }

  if (!invite) {
    return (
      <main className="admin-invite-page">
        <section className="admin-invite-card">
          <strong className="admin-login-brand">YATRA</strong>
          <h1>Invite unavailable</h1>
          <p>
            This staff invite is invalid, expired, revoked, or has already been
            used.
          </p>
          <AdminFormCallout tone="warning" title="Need a new link?">
            Contact your YATRA administrator. A replacement invite can be
            generated without creating another staff account.
          </AdminFormCallout>
          <Link className="admin-secondary-button" href="/admin/login">
            Back to Admin Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-invite-page">
      <section className="admin-invite-card">
        <strong className="admin-login-brand">YATRA</strong>
        <span className="admin-invite-card__eyebrow">STAFF INVITE</span>
        <h1>Set up your admin access</h1>
        <p>
          You&apos;ve been invited as <strong>{invite.user.name ?? "staff"}</strong>
          {" "}using <strong>{invite.user.email}</strong>.
        </p>

        <AdminFormCallout title="Invite expiry">
          This one-time link expires on{" "}
          {invite.expiresAt.toLocaleString("en-IN")}. After password setup it
          cannot be reused.
        </AdminFormCallout>

        <form action={accept} className="admin-form">
          <AdminField
            label="Create password"
            htmlFor="staffInvitePassword"
            required
            hint="12–128 characters with at least one letter and one number."
          >
            <input
              id="staffInvitePassword"
              type="password"
              name="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </AdminField>

          <AdminField
            label="Confirm password"
            htmlFor="staffInvitePasswordConfirm"
            required
          >
            <input
              id="staffInvitePasswordConfirm"
              type="password"
              name="confirmPassword"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </AdminField>

          <AdminSubmitButton
            label="Activate Staff Account"
            pendingLabel="Activating Account…"
          />
        </form>
      </section>
    </main>
  );
}
