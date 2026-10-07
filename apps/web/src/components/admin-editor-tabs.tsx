import Link from "next/link";

export type AdminEditorTab = {
  key: string;
  label: string;
  description?: string;
};

export function AdminEditorTabs({
  basePath,
  active,
  tabs,
}: {
  basePath: string;
  active: string;
  tabs: AdminEditorTab[];
}) {
  return (
    <nav className="admin-editor-tabs" aria-label="Editor sections">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`${basePath}?tab=${encodeURIComponent(tab.key)}`}
          className={
            active === tab.key
              ? "admin-editor-tab admin-editor-tab--active"
              : "admin-editor-tab"
          }
          aria-current={active === tab.key ? "page" : undefined}
        >
          <strong>{tab.label}</strong>
          {tab.description ? <small>{tab.description}</small> : null}
        </Link>
      ))}
    </nav>
  );
}
