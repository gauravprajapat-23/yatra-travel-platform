import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerLoginForm } from "@/components/customer-login-form";
import { getCustomerSession } from "@/lib/auth/customer-session";

export const metadata: Metadata = {
  title: "Customer Sign In",
  robots: { index: false, follow: false },
};

export default async function CustomerLoginPage() {
  const session=await getCustomerSession();
  if(session) redirect("/my-trips");

  return (
    <section className="customer-auth-page">
      <CustomerLoginForm />
    </section>
  );
}
