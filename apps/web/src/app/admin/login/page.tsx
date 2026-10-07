import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { getAdminSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const session = await getAdminSession();
  if (session) redirect("/admin");

  const params = await searchParams;
  const inviteAccepted = params.invite === "accepted";

  return (
    <div className="admin-root admin-login-page">
      <section className="admin-login-visual">
        <div className="admin-login-visual__shade" />
        <div className="admin-login-visual__content">
          <strong className="admin-login-brand">YATRA</strong>
          <span>ADMIN PORTAL</span>
          <h1>Manage extraordinary journeys.</h1>
          <p>Bookings. Fleet. Tours. Customers.<br />All in one unified platform.</p>
          <div className="admin-login-trust">
            <span>Trusted Operations</span>
            <span>Secure Access</span>
            <span>Built for Growth</span>
          </div>
        </div>
      </section>

      <section className="admin-login-form-wrap">
        {inviteAccepted ? (
          <p className="admin-notice" role="status">
            Staff account activated successfully. Sign in with your new password.
          </p>
        ) : null}
        <AdminLoginForm />
      </section>
    </div>
  );
}
