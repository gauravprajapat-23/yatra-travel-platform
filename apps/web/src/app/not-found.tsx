import Link from "next/link";

export default function NotFound() {
  return (
    <section className="customer-auth-page">
      <div className="customer-auth-card">
        <span className="eyebrow">404 · PAGE NOT FOUND</span>
        <h1>This journey does not exist.</h1>
        <p>
          The page may have moved, expired or no longer be published. Continue
          from one of the live travel sections below.
        </p>
        <div className="admin-form-actions">
          <Link className="button-link button-link--primary" href="/">
            Go Home
          </Link>
          <Link className="button-link button-link--ghost" href="/packages">
            Browse Packages
          </Link>
          <Link className="button-link button-link--ghost" href="/cars">
            View Cars
          </Link>
        </div>
      </div>
    </section>
  );
}
