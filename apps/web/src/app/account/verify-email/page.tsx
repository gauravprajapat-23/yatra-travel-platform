import type { Metadata } from "next";
import { CustomerEmailVerification } from "@/components/customer-email-verification";

export const metadata: Metadata = {
  title: "Verify Email",
  robots: { index: false, follow: false },
};

export default function CustomerVerifyEmailPage() {
  return (
    <section className="customer-auth-page">
      <CustomerEmailVerification />
    </section>
  );
}
