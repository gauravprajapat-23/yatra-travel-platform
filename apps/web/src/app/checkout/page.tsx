import type { Metadata } from "next";

export const metadata: Metadata = { title: "Booking Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <section className="reference-section reference-section--cream">
      <div className="shell stepper">{["Traveller Details","Add-ons","Payment","Confirmation"].map((x,i)=><span className={i===0?"stepper__step stepper__step--active":"stepper__step"} key={x}>{i+1}<small>{x}</small></span>)}</div>
      <div className="shell checkout-grid">
        <aside className="booking-card checkout-summary"><h2>Trip Summary</h2><div className="checkout-trip-image"/><h3>Kedarnath Yatra</h3><p>6 Days / 5 Nights · SUV</p><ul><li>Vehicle with experienced driver</li><li>Fuel, toll & driver allowance</li><li>Hotel accommodations (as per plan)</li><li>24×7 on-trip support</li></ul><div className="fare-total"><span>Total Amount</span><strong>₹48,000</strong></div></aside>
        <section className="booking-card"><h2>Traveller Details</h2><div className="form-grid"><label>Full Name<input defaultValue="Rohit Sharma"/></label><label>Email<input defaultValue="rohit.sharma@gmail.com"/></label><label>Mobile Number<input defaultValue="+91 98765 43210"/></label></div><h3>Travellers (4)</h3>{["Rohit Sharma","Priya Sharma","Aarav Sharma","Meera Sharma"].map((x,i)=><div className="traveller-row" key={x}><span>{i+1}</span><strong>{x}</strong><small>Adult</small></div>)}</section>
        <aside className="booking-card payment-column"><h2>Add-ons</h2>{["VIP Darshan Pass","Puja & Abhishek","Travel Insurance","Extra Luggage Space","Photoshoot at Temple"].map(x=><label className="payment-option" key={x}><input type="checkbox"/><span>{x}</span></label>)}<h2>Payment Details</h2><div className="payment-tabs"><button className="payment-tab payment-tab--active">UPI</button><button className="payment-tab">Card</button><button className="payment-tab">Net Banking</button></div><label>UPI ID<input defaultValue="rohit@okaxis"/></label><label className="terms-check"><input type="checkbox" defaultChecked/>I accept the Terms & Conditions and Cancellation Policy</label><a className="button-link button-link--primary" href="/payment">Confirm Booking & Pay →</a></aside>
      </div>
    </section>
  );
}
