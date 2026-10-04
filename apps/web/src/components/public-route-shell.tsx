import { ButtonLink } from "@/components/button-link";

type PublicRouteShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
};

export function PublicRouteShell({
  eyebrow,
  title,
  description,
  primaryHref = "/custom-trip",
  primaryLabel = "Plan a Trip",
}: PublicRouteShellProps) {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section className="route-shell">
        <div className="shell">
          <div className="route-shell__card">
            <h2>Designed into the YATRA public system.</h2>
            <p>
              This route is wired into the shared responsive shell, typography,
              colors, navigation, metadata strategy and accessibility baseline.
              Its domain-specific content and data layer will be completed in
              the relevant feature phase.
            </p>
            <ButtonLink href={primaryHref}>{primaryLabel}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
