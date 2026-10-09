import type { Metadata } from "next";
import "../admin-editor.css";
import { AdminGlobalFormGuard } from "@/components/admin-global-form-guard";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AdminGlobalFormGuard />
      {children}
    </>
  );
}
