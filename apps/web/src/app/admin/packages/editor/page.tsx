import { redirect } from "next/navigation";

export default function LegacyPackageEditorPage() {
  redirect("/admin/packages");
}
