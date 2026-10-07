import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
import { AdminEditorTabs } from "@/components/admin-editor-tabs";
import { AdminTextareaField } from "@/components/admin-textarea-field";
import { AdminPublicationFields } from "@/components/admin-publication-fields";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminField, AdminFormGrid } from "@/components/admin-form";
import { requireAdminSession } from "@/lib/auth/session";
import {
  faqScopes,
  faqStatuses,
  isFaqScope,
  isFaqStatus,
  updateFaq,
} from "@/modules/content/faq-management-service";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  return "gray";
}

function localDateTime(value: Date | null): string {
  if (!value) return "";
  return new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 16);
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid schedule date.");
  return date;
}

export default async function FaqDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const activeTab = ["overview", "content", "publishing"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "overview";
  const db = getDb();

  const faq = await db.faq.findUnique({ where: { id } });
  if (!faq) notFound();

  const faqId = faq.id;

  async function save(formData: FormData) {
    "use server";

    const currentSession = await requireAdminSession();
    if (!hasPermission(currentSession.roles, "content.write")) {
      redirect("/admin/faq");
    }

    const scope = String(formData.get("scope") ?? "");
    const status = String(formData.get("status") ?? "");

    if (!isFaqScope(scope)) throw new Error("Invalid FAQ scope.");
    if (!isFaqStatus(status)) throw new Error("Invalid FAQ status.");

    await updateFaq({
      faqId,
      scope,
      question: String(formData.get("question") ?? ""),
      answer: String(formData.get("answer") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      status,
      scheduledFor: parseOptionalDate(formData.get("scheduledFor")),
      actorUserId: currentSession.userId,
    });

    revalidatePath("/admin/faq");
    revalidatePath(`/admin/faq/${faqId}`);
    revalidatePath("/faq");
  }

  return (
    <AdminShell
      active="FAQs"
      title={faq.question}
      subtitle={faq.scope.replaceAll("_", " ")}
      actions={<Link className="admin-secondary-button" href="/admin/faq">← FAQs</Link>}
    >
      <AdminEditorTabs
        basePath={`/admin/faq/${faq.id}`}
        active={activeTab}
        tabs={[
          { key: "overview", label: "Overview", description: "Status & placement" },
          { key: "content", label: "Content", description: "Question & answer" },
          { key: "publishing", label: "Publishing", description: "Scope & schedule" },
        ]}
      />

      <div className="admin-editor-section-stack">
        {activeTab === "overview" ? (
          <section className="admin-panel admin-detail-card">
            <div className="admin-panel-heading">
              <h2>FAQ Overview</h2>
              <StatusPill tone={tone(faq.status)}>{faq.status.replaceAll("_", " ")}</StatusPill>
            </div>
            <dl>
              <div><dt>Scope</dt><dd>{faq.scope.replaceAll("_", " ")}</dd></div>
              <div><dt>Sort order</dt><dd>{faq.sortOrder}</dd></div>
              <div><dt>Published</dt><dd>{faq.publishedAt?.toLocaleString("en-IN") ?? "—"}</dd></div>
              <div><dt>Scheduled</dt><dd>{faq.scheduledFor?.toLocaleString("en-IN") ?? "—"}</dd></div>
              <div><dt>Updated</dt><dd>{faq.updatedAt.toLocaleString("en-IN")}</dd></div>
            </dl>
          </section>
        ) : null}

        {activeTab === "content" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Question & Answer</h2>
            {hasPermission(session.roles, "content.write") ? (
              <form action={save}>
                <input type="hidden" name="scope" value={faq.scope}/>
                <input type="hidden" name="sortOrder" value={faq.sortOrder}/>
                <input type="hidden" name="status" value={faq.status}/>
                <input type="hidden" name="scheduledFor" value={localDateTime(faq.scheduledFor)}/>
                <AdminFormGrid columns={1}>
                  <AdminTextareaField
                    id="faqQuestion"
                    name="question"
                    label="Question"
                    defaultValue={faq.question}
                    required
                    minLength={5}
                    maxLength={500}
                    rows={4}
                    hint="Keep the question clear and specific."
                  />

                  <AdminTextareaField
                    id="faqAnswer"
                    name="answer"
                    label="Answer"
                    defaultValue={faq.answer}
                    required
                    minLength={5}
                    maxLength={5000}
                    rows={12}
                    hint="Answer directly, then add only the detail customers need."
                  />
                </AdminFormGrid>
                <AdminSubmitButton
                  label="Save FAQ Content"
                  pendingLabel="Saving FAQ…"
                />
              </form>
            ) : <p>Your role has read-only content access.</p>}
          </section>
        ) : null}

        {activeTab === "publishing" ? (
          <section className="admin-panel admin-detail-card">
            <h2>Placement & Publishing</h2>
            {hasPermission(session.roles, "content.write") ? (
              <form action={save}>
                <input type="hidden" name="question" value={faq.question}/>
                <input type="hidden" name="answer" value={faq.answer}/>
                <AdminFormGrid columns={2}>
                  <AdminField label="Scope" htmlFor="faqScope" required>
                    <select
                      id="faqScope"
                      name="scope"
                      defaultValue={faq.scope}
                    >
                      {faqScopes.map((scope) => (
                        <option key={scope} value={scope}>
                          {scope.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </AdminField>

                  <AdminField
                    label="Sort order"
                    htmlFor="faqSortOrder"
                    hint="Lower values appear earlier."
                  >
                    <input
                      id="faqSortOrder"
                      type="number"
                      name="sortOrder"
                      defaultValue={faq.sortOrder}
                      min={-100000}
                      max={100000}
                    />
                  </AdminField>

                  <AdminPublicationFields
                    statuses={faqStatuses.map((status) => ({
                      value: status,
                      label: status.replaceAll("_", " "),
                    }))}
                    defaultStatus={faq.status}
                    defaultScheduledFor={localDateTime(faq.scheduledFor)}
                    statusId="faqStatus"
                    scheduleId="faqScheduledFor"
                  />
                </AdminFormGrid>
                <AdminSubmitButton
                  label="Save Publishing"
                  pendingLabel="Saving Publishing…"
                />
              </form>
            ) : <p>Your role has read-only content access.</p>}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
