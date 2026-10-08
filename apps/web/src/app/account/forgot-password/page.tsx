import type { Metadata } from "next";
import { CustomerForgotPasswordForm } from "@/components/customer-forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  robots: { index: false, follow: false },
};

export default function CustomerForgotPasswordPage() {
  return (
    <section className="customer-auth-page">
      <CustomerForgotPasswordForm />
    </section>
  );
}
