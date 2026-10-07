import type { ReactNode } from "react";

export function AdminDangerZone({
  title = "Danger Zone",
  description,
  children,
}: {
  title?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-danger-zone">
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="admin-danger-zone__actions">{children}</div>
    </section>
  );
}
