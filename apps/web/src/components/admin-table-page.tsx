import type { ReactNode } from "react";
import { AdminMetric, AdminShell, StatusPill } from "@/components/admin-shell";

type Row = Array<string | ReactNode>;

export function AdminTablePage({
  active,title,subtitle,buttonLabel,actions,metrics,filters,columns,rows
}:{
  active:string;title:string;subtitle:string;buttonLabel?:string;actions?:ReactNode;
  metrics:Array<{label:string;value:string;meta?:string;tone?:"green"|"orange"|"red"|"blue"}>;
  filters:string[];columns:string[];rows:Row[];
}) {
  return (
    <AdminShell
      active={active}
      title={title}
      subtitle={subtitle}
      actions={
        actions ??
        (buttonLabel ? (
          <button className="admin-primary-button">＋ {buttonLabel}</button>
        ) : null)
      }
    >
      <div className="admin-metric-grid">
        {metrics.map(m=><AdminMetric {...m} key={m.label}/>)}
      </div>

      <section className="admin-panel">
        <div className="admin-filter-tabs">
          {filters.map((x,i)=><button className={i===0?"admin-filter-tab admin-filter-tab--active":"admin-filter-tab"} key={x}>{x}</button>)}
          <label className="admin-table-search"><span>⌕</span><input placeholder={`Search ${title.toLowerCase()}...`} /></label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead>
            <tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>

        <div className="admin-pagination"><span>Showing 1–10</span><div><button>‹</button><button className="is-current">1</button><button>2</button><button>3</button><button>›</button></div></div>
      </section>
    </AdminShell>
  );
}

export { StatusPill };
