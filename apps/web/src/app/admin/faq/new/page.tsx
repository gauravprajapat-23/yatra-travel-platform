import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createFaq,
  faqScopes,
  faqStatuses,
  isFaqScope,
  isFaqStatus,
} from "@/modules/content/faq-management-service";

export const dynamic = "force-dynamic";

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid schedule date.");
  return date;
}

export default async function NewFaqPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.write")) redirect("/admin/faq");

  async function create(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/faq");
    }

    const scope = String(formData.get("scope") ?? "");
    const status = String(formData.get("status") ?? "DRAFT");

    if (!isFaqScope(scope)) throw new Error("Invalid FAQ scope.");
    if (!isFaqStatus(status)) throw new Error("Invalid FAQ status.");

    const faq = await createFaq({
      scope,
      question: String(formData.get("question") ?? ""),
      answer: String(formData.get("answer") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      status,
      scheduledFor: parseOptionalDate(formData.get("scheduledFor")),
      actorUserId: currentSession.userId,
    });

    redirect(`/admin/faq/${faq.id}`);
  }

  return (
    <AdminShell
      active="FAQs"
      title="New FAQ"
      subtitle="Create a draft or published FAQ entry."
      actions={
        <Link className="admin-secondary-button" href="/admin/faq">
          ← FAQs
        </Link>
      }
    >
      <section className="admin-panel admin-detail-card">
        <form action={create}>
          <label>
            Scope
            <select name="scope" defaultValue="GENERAL">
              {faqScopes.map((scope) => (
                <option key={scope} value={scope}>{scope.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <label>
            Question
            <textarea name="question" required minLength={5} maxLength={500}/>
          </label>

          <label>
            Answer
            <textarea name="answer" required minLength={5} maxLength={5000} rows={10}/>
          </label>

          <label>
            Sort order
            <input type="number" name="sortOrder" defaultValue={0} min={-100000} max={100000}/>
          </label>

          <label>
            Status
            <select name="status" defaultValue="DRAFT">
              {faqStatuses.map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>

          <label>
            Schedule date
            <input type="datetime-local" name="scheduledFor"/>
          </label>

          <button className="admin-primary-button" type="submit">
            Create FAQ
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
