import type { Metadata } from "next";

export const metadata: Metadata = { title: "Car Booking", robots: { index: false, follow: false } };

export default function CarBookingPage() {
  return (
    <section className="reference-section reference-section--cream">
      <div className="shell stepper">{["Select Vehicle","Trip Details","Traveller Details","Add-ons","Payment"].map((x,i)=><span className={i<=2?"stepper__step stepper__step--active":"stepper__step"} key={x}>{i+1}<small>{x}</small></span>)}</div>
      <div className="shell booking-layout">
        <div className="booking-main">
          <section className="booking-card"><h2>Your Selected Vehicle</h2><div className="selected-vehicle"><div className="selected-vehicle__visual"><div className="vehicle-list-card__car"/></div><div><h3>Toyota Innova Crysta</h3><p>Premium MUV · 6+1 Seats · AC · Ideal for Families</p><div className="reference-hero-badges"><span>Driver Included</span><span>Fuel Included</span><span>Toll & State Permit</span><span>24×7 Support</span></div></div></div></section>
          <section className="booking-card"><h2>Traveller Details</h2><div className="form-grid"><label>Full Name<input defaultValue="Arjun Mehta"/></label><label>Email<input defaultValue="arjun.mehta@email.com"/></label><label>Mobile Number<input defaultValue="+91 98765 43210"/></label></div><h3>Additional Travellers</h3><div className="traveller-pills"><span>Priya Mehta</span><span>Rohan Mehta</span><span>Sneha Mehta</span></div></section>
          <section className="booking-card"><h2>Add-ons & Customisations</h2><div className="addon-grid">{["Extra Luggage Space · ₹500","Child Seat · ₹300","Additional Driver · ₹700/day","Bottled Water Pack · ₹200"].map(x=><label key={x}><input type="checkbox"/>{x}</label>)}</div></section>
        </div>
        <aside className="booking-sidebar"><div className="booking-card"><h2>Trip Details</h2><div className="trip-pair"><strong>Raipur</strong><span>→</span><strong>Ujjain</strong></div><dl><div><dt>Departure</dt><dd>12 Oct 2024</dd></div><div><dt>Return</dt><dd>15 Oct 2024</dd></div><div><dt>Duration</dt><dd>4 Days</dd></div><div><dt>Travellers</dt><dd>4 Adults</dd></div></dl></div><div className="booking-card fare-card"><h2>Fare Breakup</h2><dl><div><dt>Base Fare</dt><dd>₹14,000</dd></div><div><dt>Driver Allowance</dt><dd>₹1,200</dd></div><div><dt>Fuel (Estimated)</dt><dd>₹2,600</dd></div><div><dt>Toll & Permit</dt><dd>₹1,000</dd></div></dl><div className="fare-total"><span>Total Amount</span><strong>₹19,300</strong></div><a className="button-link button-link--primary" href="/checkout">Proceed to Payment →</a></div></aside>
      </div>
    </section>
  );
}
