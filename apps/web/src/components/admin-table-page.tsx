import type { ReactNode } from "react";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";

type Row = Array<string | ReactNode>;

export function AdminTablePage({
  active,
  title,
  subtitle,
  buttonLabel,
  actions,
  metrics,
  filters,
  columns,
  rows,
}: {
  active: string;
  title: string;
  subtitle: string;
  buttonLabel?: string;
  actions?: ReactNode;
  metrics: Array<{
    label: string;
    value: string;
    meta?: string;
    tone?: "green" | "orange" | "red" | "blue";
  }>;
  filters: string[];
  columns: string[];
  rows: Row[];
}) {
  return (
    <AdminShell
      active={active}
      title={title}
      subtitle={subtitle}
      actions={
        actions ??
        (buttonLabel ? (
          <span className="admin-primary-button" aria-disabled="true">
            ＋ {buttonLabel}
          </span>
        ) : null)
      }
    >
      <div className="admin-metric-grid">
        {metrics.map((metric) => (
          <AdminMetric {...metric} key={metric.label} />
        ))}
      </div>

      <section className="admin-panel">
        <div className="admin-table-scope">
          <div className="admin-table-scope__chips">
            {filters.map((filter) => (
              <span className="admin-filter-tab admin-filter-tab--active" key={filter}>
                {filter}
              </span>
            ))}
          </div>
          <span className="admin-table-scope__count">
            {rows.length} loaded row{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="admin-table-empty">
            <strong>No records to show</strong>
            <p>No rows were returned for the current loaded scope.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-table-footer">
          <span>
            Showing {rows.length} loaded record{rows.length === 1 ? "" : "s"}
          </span>
          <small>
            Search, filtering and pagination appear only on pages with real
            server-side query controls.
          </small>
        </div>
      </section>
    </AdminShell>
  );
}

export { StatusPill };
