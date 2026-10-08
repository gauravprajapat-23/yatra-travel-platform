import type { Metadata } from "next";
import { CustomerVerificationRequestForm } from "@/components/customer-verification-request-form";

export const metadata: Metadata = {
  title: "Resend Verification Email",
  robots: { index: false, follow: false },
};

export default function CustomerVerificationRequestPage() {
  return (
    <section className="customer-auth-page">
      <CustomerVerificationRequestForm />
    </section>
  );
}
