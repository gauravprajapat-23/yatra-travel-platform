import Link from "next/link";
import { footerNavigation, legalNavigation } from "@/lib/navigation";
import { ButtonLink } from "@/components/button-link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__cta">
        <div>
          <p className="eyebrow">YOUR NEXT GREAT JOURNEY</p>
          <h2>Tell us where you want to go.</h2>
          <p>We’ll help shape the route around your time, people and pace.</p>
        </div>
        <ButtonLink href="/custom-trip">Plan My Trip</ButtonLink>
      </div>

      <div className="shell site-footer__grid">
        <div>
          <Link className="brand-mark brand-mark--footer" href="/">
            YATRA
          </Link>
          <p className="site-footer__summary">
            Chauffeur-driven road journeys, temple circuits and curated tours
            across India.
          </p>
        </div>

        <nav aria-label="Footer navigation" className="site-footer__links">
          {footerNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="shell site-footer__legal">
        <p>© {new Date().getFullYear()} YATRA. All rights reserved.</p>
        <nav aria-label="Legal navigation">
          {legalNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
