import Link from "next/link";
import { primaryNavigation } from "@/lib/navigation";
import { ButtonLink } from "@/components/button-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link aria-label="Yatra home" className="brand-mark" href="/">
          YATRA
        </Link>

        <nav aria-label="Primary navigation" className="desktop-nav">
          {primaryNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="desktop-nav">
          <ButtonLink href="/custom-trip">Plan a Trip</ButtonLink>
        </div>

        <details className="mobile-nav">
          <summary aria-label="Open navigation">Menu</summary>
          <nav aria-label="Mobile navigation" className="mobile-nav__panel">
            {primaryNavigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <ButtonLink href="/custom-trip">Plan a Trip</ButtonLink>
          </nav>
        </details>
      </div>
    </header>
  );
}
