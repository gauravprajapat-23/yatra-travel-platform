import Link from "next/link";

export type AdminCompletionItem = {
  label: string;
  detail: string;
  ready: boolean;
  href: string;
};

export function AdminCompletionChecklist({
  title = "Completion Checklist",
  items,
}: {
  title?: string;
  items: AdminCompletionItem[];
}) {
  const readyCount = items.filter((item) => item.ready).length;

  return (
    <section className="admin-completion-checklist">
      <header>
        <div>
          <strong>{title}</strong>
          <small>
            {readyCount}/{items.length} sections ready
          </small>
        </div>
        <span>
          {items.length === 0
            ? "—"
            : `${Math.round((readyCount / items.length) * 100)}%`}
        </span>
      </header>

      <div>
        {items.map((item) => (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            className={
              item.ready
                ? "admin-completion-checklist__item admin-completion-checklist__item--ready"
                : "admin-completion-checklist__item"
            }
          >
            <span aria-hidden="true">{item.ready ? "✓" : "!"}</span>
            <div>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
