import "../admin-editor.css";
import { AdminGlobalFormGuard } from "@/components/admin-global-form-guard";

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
