import type { Metadata } from "next";
import { CustomerResetPasswordForm } from "@/components/customer-reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default async function CustomerResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  return (
    <section className="customer-auth-page">
      <CustomerResetPasswordForm token={token} />
    </section>
  );
}
