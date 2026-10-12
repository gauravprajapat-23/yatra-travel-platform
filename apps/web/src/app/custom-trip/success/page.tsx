import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Trip Request Received",
  description: "Your custom YATRA trip request has been received.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CustomTripSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const reference = first(params.reference).trim().slice(0, 64);

  return (
    <section className="reference-section reference-section--cream">
      <div className="shell">
        <article className="booking-card checkout-invalid-state">
          <p className="eyebrow">REQUEST RECEIVED</p>
          <h1>Your custom trip request is with the YATRA team.</h1>
          <p>
            This is a travel enquiry, not a confirmed booking. Our team will
            review the route, dates, vehicle needs and current availability
            before sending or enabling a payable quote.
          </p>

          {reference ? (
            <dl className="checkout-trip-details">
              <div>
                <dt>Request reference</dt>
                <dd>{reference}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Awaiting review</dd>
              </div>
            </dl>
          ) : null}

          <div className="custom-trip-checkout-notice">
            <strong>No payment is required now</strong>
            <p>
              Do not make a payment until a server-created booking and verified
              price are available.
            </p>
          </div>

          <div className="admin-form-actions">
            <Link className="button-link button-link--primary" href="/packages">
              Browse Published Tours →
            </Link>
            <Link className="button-link button-link--ghost" href="/">
              Back to Home
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
