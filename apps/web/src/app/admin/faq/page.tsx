import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function tone(status: string): "green" | "orange" | "red" | "blue" | "gray" {
  if (status === "PUBLISHED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "DRAFT" || status === "REVIEW") return "orange";
  if (status === "ARCHIVED") return "gray";
  return "gray";
}

export default async function AdminFaqPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "content.read")) redirect("/admin");

  const db = getDb();

  const [faqs, total, published, drafts, scheduled] = await Promise.all([
    db.faq.findMany({
      orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 200,
    }),
    db.faq.count(),
    db.faq.count({ where: { status: "PUBLISHED" } }),
    db.faq.count({ where: { status: { in: ["DRAFT", "REVIEW"] } } }),
    db.faq.count({ where: { status: "SCHEDULED" } }),
  ]);

  return (
    <AdminShell
      active="FAQs"
      title="FAQs"
      subtitle="Manage the published answers shown on the public FAQ page."
      actions={
        hasPermission(session.roles, "content.write") ? (
          <Link className="admin-primary-button" href="/admin/faq/new">
            ＋ New FAQ
          </Link>
        ) : null
      }
    >
      <div className="admin-metric-grid">
        <AdminMetric label="All FAQs" value={total.toString()} meta="all records" tone="blue"/>
        <AdminMetric label="Published" value={published.toString()} meta="visible publicly" tone="green"/>
        <AdminMetric label="Draft / Review" value={drafts.toString()} meta="work in progress" tone="orange"/>
        <AdminMetric label="Scheduled" value={scheduled.toString()} meta="future publication" tone="blue"/>
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Scope</th>
                <th>Sort</th>
                <th>Status</th>
                <th>Published</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {faqs.length === 0 ? (
                <tr><td colSpan={6}>No FAQ entries exist yet.</td></tr>
              ) : (
                faqs.map((faq) => (
                  <tr key={faq.id}>
                    <td>
                      <Link href={`/admin/faq/${faq.id}`}>
                        {faq.question}
                      </Link>
                    </td>
                    <td>{faq.scope.replaceAll("_", " ")}</td>
                    <td>{faq.sortOrder}</td>
                    <td>
                      <StatusPill tone={tone(faq.status)}>
                        {faq.status.replaceAll("_", " ")}
                      </StatusPill>
                    </td>
                    <td>{faq.publishedAt?.toLocaleString("en-IN") ?? "—"}</td>
                    <td>{faq.updatedAt.toLocaleString("en-IN")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
