import Link from "next/link";
import type { ReactNode } from "react";
import {
  hasPermission,
  type Permission,
} from "@yatra/domain/auth/permissions";
import { requireAdminSession } from "@/lib/auth/session";

const nav: Array<{
  href: string;
  label: string;
  permission: Permission;
}> = [
  { href: "/admin", label: "Dashboard", permission: "admin.access" },
  { href: "/admin/bookings", label: "Bookings", permission: "booking.read" },
  { href: "/admin/packages", label: "Tours & Packages", permission: "package.read" },
  { href: "/admin/vehicles", label: "Fleet Management", permission: "vehicle.read" },
  { href: "/admin/customers", label: "Customers", permission: "customer.read" },
  { href: "/admin/leads", label: "Enquiries / Leads", permission: "lead.read" },
  { href: "/admin/drivers", label: "Drivers & Staff", permission: "driver.read" },
  { href: "/admin/payments", label: "Payments", permission: "payment.read" },
  { href: "/admin/destinations", label: "Destinations", permission: "content.read" },
  { href: "/admin/offers", label: "Offers", permission: "settings.manage" },
  { href: "/admin/cms", label: "CMS Pages", permission: "content.read" },
  { href: "/admin/blog", label: "Blog", permission: "content.read" },
  { href: "/admin/faq", label: "FAQs", permission: "content.read" },
  { href: "/admin/media", label: "Media Library", permission: "content.read" },
  { href: "/admin/seo", label: "SEO Manager", permission: "seo.manage" },
  { href: "/admin/staff", label: "Staff / Roles", permission: "staff.manage" },
  { href: "/admin/reports", label: "Reports", permission: "report.read" },
  { href: "/admin/audit", label: "Audit Log", permission: "audit.read" },
  { href: "/admin/settings", label: "Settings", permission: "settings.manage" },
];

export async function AdminShell({
  active,
  title,
  subtitle,
  actions,
  children,
}: {
  active: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const session = await requireAdminSession();
  const visibleNav = nav.filter((item) =>
    hasPermission(session.roles, item.permission),
  );

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">YATRA</Link>
        <nav>
          {visibleNav.map(({ href, label }) => (
            <Link
              className={active===label ? "admin-nav-link admin-nav-link--active":"admin-nav-link"}
              href={href}
              key={href}
            >
              <span className="admin-nav-icon">◈</span>
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <label className="admin-search">
            <span>⌕</span>
            <input aria-label="Admin search" placeholder="Search bookings, customers, tours..." />
          </label>

          <div className="admin-topbar__right">
            <button aria-label="Notifications" type="button">♢</button>
            <span className="admin-avatar">AA</span>
            <strong>{session.name ?? "Admin"}</strong>
            <form action="/api/admin-auth/logout" method="post">
              <button className="admin-logout-button" type="submit">Logout</button>
            </form>
          </div>
        </header>

        <main className="admin-main">
          <div className="admin-page-heading">
            <div>
              <h1>{title}</h1>
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <div className="admin-heading-actions">{actions}</div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminMetric({
  label,
  value,
  meta,
  tone="green",
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "green"|"orange"|"red"|"blue";
}) {
  return (
    <article className="admin-metric">
      <span className={`admin-metric__icon admin-metric__icon--${tone}`}>◆</span>
      <small>{label}</small>
      <strong>{value}</strong>
      {meta ? <p>{meta}</p> : null}
    </article>
  );
}

export function StatusPill({
  children,
  tone="green",
}: {
  children: ReactNode;
  tone?: "green"|"orange"|"red"|"blue"|"gray";
}) {
  return <span className={`admin-status admin-status--${tone}`}>{children}</span>;
}
