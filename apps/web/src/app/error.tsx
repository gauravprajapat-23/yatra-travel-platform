"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reference = error.digest?.slice(0, 32);

  return (
    <main className="public-shell">
      <section className="customer-auth-page">
        <div className="customer-auth-card">
          <span className="eyebrow">TEMPORARY ERROR</span>
          <h1>Something went wrong.</h1>
          <p>
            The request could not be completed. You can retry without
            re-entering sensitive information.
          </p>
          {reference ? (
            <small>Reference: {reference}</small>
          ) : null}
          <button
            className="button-link button-link--primary"
            type="button"
            onClick={() => reset()}
          >
            Try Again
          </button>
        </div>
      </section>
    </main>
  );
}
