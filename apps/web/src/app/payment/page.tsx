import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment Status", robots: { index: false, follow: false } };

export default function PaymentPage() {
  return (
    <>
      <section className="story-hero story-hero--payment"><div className="story-hero__overlay"/><div className="shell story-hero__content"><p className="eyebrow">SECURE BOOKING</p><h1>Almost there…</h1><p>Your journey is just a step away. We&apos;re processing your payment securely.</p></div></section>
      <section className="reference-section reference-section--cream"><div className="shell payment-state-card"><div className="payment-spinner"/><h2>Processing Your Payment</h2><p>Please do not close this window. We are securely authorizing your payment with the bank.</p><div className="payment-progress"><span>Connecting to bank</span><strong>Authorizing payment</strong><span>Confirming booking</span></div></div><div className="shell payment-state-grid"><article className="state-card state-card--success"><b>✓</b><h3>Payment Successful</h3><p>Your payment has been processed.</p><a href="/booking/success">View Booking Details →</a></article><article className="state-card state-card--pending"><b>◷</b><h3>Payment Pending</h3><p>Your payment is under process.</p><a href="/my-trips">View Payment Status →</a></article><article className="state-card state-card--failed"><b>×</b><h3>Payment Failed</h3><p>Your payment could not be processed.</p><a className="button-link button-link--primary" href="/checkout">Try Again →</a></article></div></section>
    </>
  );
}
