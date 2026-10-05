import Link from "next/link";
import { ButtonLink } from "@/components/button-link";

const nav = [
  { href: "/cars", label: "Cars" },
  { href: "/packages", label: "Tours" },
  { href: "/destinations", label: "Destinations" },
  { href: "/offers", label: "Offers" },
];

export function SiteHeader() {
  return (
    <header className="site-header site-header--reference">
      <div className="shell site-header__inner">
        <Link aria-label="Yatra home" className="brand-mark" href="/">
          YATRA
        </Link>

        <nav aria-label="Primary navigation" className="desktop-nav">
          {nav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="desktop-nav desktop-nav--cta">
          <ButtonLink href="/custom-trip">Plan a Trip</ButtonLink>
        </div>

        <details className="mobile-nav">
          <summary aria-label="Open navigation">Menu</summary>
          <nav aria-label="Mobile navigation" className="mobile-nav__panel">
            {nav.map((item) => (
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
