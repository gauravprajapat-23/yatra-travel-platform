import Link from "next/link";
import type { ReactNode } from "react";

const nav = [
  ["/admin","Dashboard"],
  ["/admin/bookings","Bookings"],
  ["/admin/packages","Tours & Packages"],
  ["/admin/vehicles","Fleet Management"],
  ["/admin/customers","Customers"],
  ["/admin/leads","Enquiries / Leads"],
  ["/admin/drivers","Drivers & Staff"],
  ["/admin/payments","Finance & Reports"],
  ["/admin/destinations","Destinations"],
  ["/admin/offers","Offers"],
  ["/admin/blog","Blog"],
  ["/admin/media","Media Library"],
  ["/admin/seo","SEO Manager"],
  ["/admin/staff","Staff / Roles"],
  ["/admin/reports","Reports"],
  ["/admin/settings","Settings"],
];

export function AdminShell({active, title, subtitle, actions, children}:{active:string;title:string;subtitle?:string;actions?:ReactNode;children:ReactNode}) {
  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">YATRA</Link>
        <nav>
          {nav.map(([href,label]) => (
            <Link className={active===label ? "admin-nav-link admin-nav-link--active":"admin-nav-link"} href={href} key={href}><span className="admin-nav-icon">◈</span>{label}</Link>
          ))}
        </nav>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <label className="admin-search"><span>⌕</span><input aria-label="Admin search" placeholder="Search bookings, customers, tours..." /></label>
          <div className="admin-topbar__right"><button aria-label="Notifications">♢</button><span className="admin-avatar">AA</span><strong>Admin</strong><span>⌄</span></div>
        </header>

        <main className="admin-main">
          <div className="admin-page-heading">
            <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
            <div className="admin-heading-actions">{actions}</div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminMetric({label,value,meta,tone="green"}:{label:string;value:string;meta?:string;tone?:"green"|"orange"|"red"|"blue"}) {
  return <article className="admin-metric"><span className={`admin-metric__icon admin-metric__icon--${tone}`}>◆</span><small>{label}</small><strong>{value}</strong>{meta ? <p>{meta}</p> : null}</article>;
}

export function StatusPill({children,tone="green"}:{children:ReactNode;tone?:"green"|"orange"|"red"|"blue"|"gray"}) {
  return <span className={`admin-status admin-status--${tone}`}>{children}</span>;
}
