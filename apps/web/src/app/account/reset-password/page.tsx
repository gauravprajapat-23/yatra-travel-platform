import type { Metadata } from "next";
import { CustomerResetPasswordForm } from "@/components/customer-reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default function CustomerResetPasswordPage() {
  return (
    <section className="customer-auth-page">
      <CustomerResetPasswordForm />
    </section>
  );
}
