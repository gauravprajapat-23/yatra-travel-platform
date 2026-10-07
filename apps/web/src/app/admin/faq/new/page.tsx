import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell } from "@/components/admin-shell";
import {
  AdminField,
  AdminFormActions,
  AdminFormAsideCard,
  AdminFormCallout,
  AdminFormGrid,
  AdminFormSection,
} from "@/components/admin-form";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import { AdminPublicationFields } from "@/components/admin-publication-fields";
import {
  AdminActionForm,
  type AdminActionState,
} from "@/components/admin-action-form";
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

  async function create(
    _previousState: AdminActionState,
    formData: FormData,
  ): Promise<AdminActionState> {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/faq");
    }

    let faqId: string;

    try {
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

      faqId = faq.id;
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create FAQ.",
      };
    }

    redirect(`/admin/faq/${faqId}`);
  }

  return (
    <AdminShell
      active="FAQs"
      title="New FAQ"
      subtitle="Create a reusable answer, choose where it appears, and control draft, scheduled or published state."
      actions={<Link className="admin-secondary-button" href="/admin/faq">← FAQs</Link>}
    >
      <AdminActionForm
        action={create}
        className="admin-form"
        aside={
          <>
            <AdminFormAsideCard title="FAQ guidance">
              <ul>
                <li>Keep questions natural and specific.</li>
                <li>Answer directly before adding detail.</li>
                <li>Use scope to avoid unrelated placement.</li>
              </ul>
            </AdminFormAsideCard>
            <AdminFormAsideCard title="Scheduling">
              <p>If status is SCHEDULED, choose the intended publication date and ensure the scheduled publisher is healthy.</p>
            </AdminFormAsideCard>
          </>
        }
      >
        <AdminFormSection title="Question & answer" description="Write the customer-facing FAQ content." badge="Required">
          <AdminFormGrid columns={1}>
            <AdminTextareaField
              id="question"
              name="question"
              label="Question"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              placeholder="What is included in the package price?"
              hint="Keep the question clear and specific."
            />
            <AdminTextareaField
              id="answer"
              name="answer"
              label="Answer"
              required
              minLength={5}
              maxLength={5000}
              rows={10}
              placeholder="Give a clear answer, then add only the detail customers need."
              hint="Answer directly, then add only the detail customers need."
            />
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Placement & order" description="Choose where the FAQ is used and how it is ordered relative to nearby entries.">
          <AdminFormGrid columns={2}>
            <AdminField label="Scope" htmlFor="scope">
              <select id="scope" name="scope" defaultValue="GENERAL">
                {faqScopes.map((scope) => (
                  <option key={scope} value={scope}>{scope.replaceAll("_", " ")}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Sort order" htmlFor="sortOrder" hint="Lower values appear earlier.">
              <input id="sortOrder" type="number" name="sortOrder" defaultValue={0} min={-100000} max={100000} />
            </AdminField>
          </AdminFormGrid>
        </AdminFormSection>

        <AdminFormSection title="Publication" description="Control whether this FAQ remains a draft, publishes now, or publishes on schedule.">
          <AdminFormGrid columns={2}>
            <AdminPublicationFields
              statuses={faqStatuses.map((status) => ({
                value: status,
                label: status.replaceAll("_", " "),
              }))}
              defaultStatus="DRAFT"
              statusId="status"
              scheduleId="scheduledFor"
            />
          </AdminFormGrid>
          <AdminFormCallout title="Publishing">
            Use DRAFT while reviewing. Scheduled entries depend on the scheduled publisher heartbeat shown in Admin Settings.
          </AdminFormCallout>
        </AdminFormSection>

        <AdminFormActions submitLabel="Create FAQ" cancelHref="/admin/faq" helper="Publication behavior is validated server-side." />
      </AdminActionForm>
    </AdminShell>
  );
}
