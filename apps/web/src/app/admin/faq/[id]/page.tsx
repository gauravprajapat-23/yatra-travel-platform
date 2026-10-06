import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminShell, StatusPill } from "@/components/admin-shell";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const { id } = await params;
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
      actions={
        <Link className="admin-secondary-button" href="/admin/faq">
          ← FAQs
        </Link>
      }
    >
      <div className="admin-detail-grid">
        <section className="admin-panel admin-detail-card">
          <div className="admin-panel-heading">
            <h2>FAQ Overview</h2>
            <StatusPill tone={tone(faq.status)}>
              {faq.status.replaceAll("_", " ")}
            </StatusPill>
          </div>
          <dl>
            <div><dt>Scope</dt><dd>{faq.scope.replaceAll("_", " ")}</dd></div>
            <div><dt>Sort order</dt><dd>{faq.sortOrder}</dd></div>
            <div><dt>Published</dt><dd>{faq.publishedAt?.toLocaleString("en-IN") ?? "—"}</dd></div>
            <div><dt>Scheduled</dt><dd>{faq.scheduledFor?.toLocaleString("en-IN") ?? "—"}</dd></div>
            <div><dt>Updated</dt><dd>{faq.updatedAt.toLocaleString("en-IN")}</dd></div>
          </dl>
        </section>

        <section className="admin-panel admin-detail-card">
          <h2>Edit FAQ</h2>
          {hasPermission(session.roles, "content.write") ? (
            <form action={save}>
              <label>
                Scope
                <select name="scope" defaultValue={faq.scope}>
                  {faqScopes.map((scope) => (
                    <option key={scope} value={scope}>{scope.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>

              <label>
                Question
                <textarea
                  name="question"
                  defaultValue={faq.question}
                  required
                  minLength={5}
                  maxLength={500}
                />
              </label>

              <label>
                Answer
                <textarea
                  name="answer"
                  defaultValue={faq.answer}
                  required
                  minLength={5}
                  maxLength={5000}
                  rows={12}
                />
              </label>

              <label>
                Sort order
                <input
                  type="number"
                  name="sortOrder"
                  defaultValue={faq.sortOrder}
                  min={-100000}
                  max={100000}
                />
              </label>

              <label>
                Status
                <select name="status" defaultValue={faq.status}>
                  {faqStatuses.map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>

              <label>
                Schedule date
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  defaultValue={localDateTime(faq.scheduledFor)}
                />
              </label>

              <button className="admin-primary-button" type="submit">
                Save FAQ
              </button>
            </form>
          ) : (
            <p>Your role has read-only content access.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
