import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@yatra/db/client";
import { CustomerProfileForm } from "@/components/customer-profile-form";
import { requireCustomerSession } from "@/lib/auth/customer-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Settings",
  robots: { index: false, follow: false },
};

export default async function CustomerProfilePage() {
  const session=await requireCustomerSession();
  const db=getDb();
  const user=await db.user.findUnique({
    where:{id:session.userId},
    select:{email:true,name:true,phone:true,emailVerifiedAt:true},
  });

  if(!user || !user.emailVerifiedAt) {
    return null;
  }

  return (
    <section className="customer-auth-page">
      <div>
        <Link href="/my-trips">← My Trips</Link>
        <CustomerProfileForm
          email={user.email}
          defaultName={user.name ?? ""}
          defaultPhone={user.phone ?? ""}
        />
      </div>
    </section>
  );
}
