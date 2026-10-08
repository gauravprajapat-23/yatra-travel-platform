import type { Metadata } from "next";
import { CustomerRegisterForm } from "@/components/customer-register-form";

export const metadata: Metadata = {
  title: "Create Customer Account",
  robots: { index: false, follow: false },
};

export default function CustomerRegisterPage() {
  return (
    <section className="customer-auth-page">
      <CustomerRegisterForm />
    </section>
  );
}
