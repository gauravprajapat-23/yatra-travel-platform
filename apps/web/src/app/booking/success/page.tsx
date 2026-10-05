import type { Metadata } from "next";

export const metadata: Metadata = { title: "Booking Confirmed", robots: { index: false, follow: false } };

export default function BookingSuccessPage() {
  return (
    <>
      <section className="success-hero">
        <div className="shell">
          <span className="success-icon">✓</span>
          <h1>Booking Confirmed!</h1>
          <p>Your journey with YATRA is all set.</p>
        </div>
      </section>
      <section className="reference-section reference-section--cream">
        <div className="shell success-banner">
          <span className="success-icon success-icon--small">✓</span>
          <div>
            <h2>Thank you for choosing YATRA!</h2>
            <p>A confirmation has been sent to your registered email address.</p>
          </div>
          <div><small>BOOKING ID</small><strong>YTR241015678</strong></div>
        </div>
        <div className="shell success-grid">
          <article className="booking-card">
            <h2>Trip Summary</h2>
            <div className="selected-vehicle">
              <div className="selected-vehicle__visual"><div className="vehicle-list-card__car"/></div>
              <div>
                <h3>Toyota Fortuner</h3><p>SUV · 6 Seats · Automatic</p>
                <dl><div><dt>Pickup</dt><dd>Raipur</dd></div><div><dt>Drop</dt><dd>Ujjain</dd></div><div><dt>Dates</dt><dd>12–15 Oct</dd></div><div><dt>Travellers</dt><dd>4 Adults</dd></div></dl>
                <strong>₹26,000 · Paid Successfully</strong>
              </div>
            </div>
          </article>
          <aside className="booking-card">
            <h2>Download / Share</h2>
            {["Download Invoice","Share Booking Details","Add to Calendar"].map(x=><button className="utility-action" key={x}>{x}<span>→</span></button>)}
            <div className="support-box"><strong>Need Help?</strong><p>Our travel experts are available 24×7.</p><a className="button-link button-link--primary" href="/contact">Contact Support →</a></div>
          </aside>
        </div>
      </section>
    </>
  );
}
