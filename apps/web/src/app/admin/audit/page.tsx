import { redirect } from "next/navigation";
import { getDb } from "@yatra/db/client";
import { hasPermission } from "@yatra/domain/auth/permissions";
import { AdminMetric, AdminShell } from "@/components/admin-shell";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const sensitiveKeyPattern =
  /(secret|token|password|ciphertext|signature|authorization|credential|api[-_]?key)/i;

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      result[key] = sensitiveKeyPattern.test(key)
        ? "[redacted]"
        : sanitizeMetadata(entry, depth + 1);
    }
    return result;
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  return value;
}

function metadataText(value: unknown): string {
  if (value === null || value === undefined) return "—";

  try {
    const safe = sanitizeMetadata(value);
    const rendered = JSON.stringify(safe);
    return rendered.length > 900 ? `${rendered.slice(0, 900)}…` : rendered;
  } catch {
    return "Unavailable";
  }
}

export default async function AuditPage() {
  const session = await requireAdminSession();
  if (!hasPermission(session.roles, "audit.read")) redirect("/admin");

  const db = getDb();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [events, total, last24h, actors] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
    db.auditLog.count(),
    db.auditLog.count({
      where: { createdAt: { gte: since24h } },
    }),
    db.auditLog.findMany({
      where: { actorUserId: { not: null } },
      distinct: ["actorUserId"],
      select: { actorUserId: true },
    }),
  ]);

  return (
    <AdminShell
      active="Audit Log"
      title="Audit Log"
      subtitle="Read-only security and operations history. Sensitive-looking metadata values are redacted in this view."
    >
      <div className="admin-metric-grid">
        <AdminMetric
          label="Total Events"
          value={total.toString()}
          meta="all audit records"
          tone="blue"
        />
        <AdminMetric
          label="Last 24 Hours"
          value={last24h.toString()}
          meta="recent operations"
          tone="green"
        />
        <AdminMetric
          label="Unique Actors"
          value={actors.length.toString()}
          meta="users represented in log"
          tone="orange"
        />
        <AdminMetric
          label="Loaded"
          value={events.length.toString()}
          meta="latest records shown"
          tone="blue"
        />
      </div>

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Request ID</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7}>No audit events recorded yet.</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id.toString()}>
                    <td>{event.createdAt.toLocaleString("en-IN")}</td>
                    <td>
                      {event.actor?.name ??
                        event.actor?.email ??
                        (event.actorUserId ? "Known user" : "System")}
                    </td>
                    <td>{event.action.replaceAll("_", " ")}</td>
                    <td>{event.entityType}</td>
                    <td>{event.entityId ?? "—"}</td>
                    <td>{event.requestId ?? "—"}</td>
                    <td>
                      <code>{metadataText(event.metadata)}</code>
                    </td>
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
