import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Checkout",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function clean(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const isCustomTrip = first(params.source) === "custom-trip";

  const trip = isCustomTrip
    ? {
        title: "Custom Journey",
        from: clean(first(params.from, "Delhi"), 120),
        to: clean(first(params.to, "Kedarnath"), 120),
        duration: clean(first(params.duration, "6"), 2),
        travelDate: clean(first(params.travelDate), 20),
        travellers: clean(first(params.travellers, "4"), 2),
        vehicle: clean(first(params.vehicle, "SUV · 6 Seats"), 80),
        requests: clean(first(params.requests), 1000),
      }
    : {
        title: "Kedarnath Yatra",
        from: "Delhi",
        to: "Kedarnath",
        duration: "6",
        travelDate: "",
        travellers: "4",
        vehicle: "SUV",
        requests: "",
      };

  return (
    <section className="reference-section reference-section--cream">
      <div className="shell stepper">
        {["Traveller Details", "Add-ons", "Payment", "Confirmation"].map((x, i) => (
          <span
            className={i === 0 ? "stepper__step stepper__step--active" : "stepper__step"}
            key={x}
          >
            {i + 1}
            <small>{x}</small>
          </span>
        ))}
      </div>

      <div className="shell checkout-grid">
        <aside className="booking-card checkout-summary">
          <h2>Trip Summary</h2>
          <div className="checkout-trip-image" />
          <h3>{trip.title}</h3>
          <p>
            {trip.duration} Days · {trip.vehicle}
          </p>

          {isCustomTrip ? (
            <dl className="checkout-trip-details">
              <div><dt>From</dt><dd>{trip.from}</dd></div>
              <div><dt>To</dt><dd>{trip.to}</dd></div>
              <div><dt>Travel date</dt><dd>{trip.travelDate || "To be confirmed"}</dd></div>
              <div><dt>Travellers</dt><dd>{trip.travellers}</dd></div>
            </dl>
          ) : null}

          <ul>
            <li>Vehicle with experienced driver</li>
            <li>Fuel, toll & driver allowance</li>
            <li>Custom itinerary reviewed by the YATRA team</li>
            <li>24×7 on-trip support</li>
          </ul>

          {trip.requests ? (
            <div className="checkout-special-request">
              <strong>Special requests</strong>
              <p>{trip.requests}</p>
            </div>
          ) : null}

          <div className="fare-total">
            <span>{isCustomTrip ? "Final Price" : "Total Amount"}</span>
            <strong>{isCustomTrip ? "Quote pending" : "₹48,000"}</strong>
          </div>

          {isCustomTrip ? (
            <small className="checkout-quote-note">
              Your itinerary and final price will be confirmed after server-side review.
            </small>
          ) : null}
        </aside>

        <section className="booking-card">
          <h2>Traveller Details</h2>
          <div className="form-grid">
            <label>Full Name<input defaultValue="Rohit Sharma" /></label>
            <label>Email<input defaultValue="rohit.sharma@gmail.com" /></label>
            <label>Mobile Number<input defaultValue="+91 98765 43210" /></label>
          </div>

          <h3>Travellers ({trip.travellers})</h3>
          {["Primary Traveller", "Traveller 2", "Traveller 3", "Traveller 4"]
            .slice(0, Math.min(Math.max(Number(trip.travellers) || 1, 1), 4))
            .map((x, i) => (
              <div className="traveller-row" key={x}>
                <span>{i + 1}</span>
                <strong>{x}</strong>
                <small>Adult</small>
              </div>
            ))}
        </section>

        <aside className="booking-card payment-column">
          <h2>Add-ons</h2>
          {[
            "VIP Darshan Pass",
            "Puja & Abhishek",
            "Travel Insurance",
            "Extra Luggage Space",
            "Photoshoot at Temple",
          ].map((x) => (
            <label className="payment-option" key={x}>
              <input type="checkbox" />
              <span>{x}</span>
            </label>
          ))}

          <h2>Payment Details</h2>

          {isCustomTrip ? (
            <div className="custom-trip-checkout-notice">
              <strong>Price confirmation required</strong>
              <p>
                Payment will be enabled after your custom itinerary and final server quote are confirmed.
              </p>
            </div>
          ) : (
            <>
              <div className="payment-tabs">
                <button className="payment-tab payment-tab--active">UPI</button>
                <button className="payment-tab">Card</button>
                <button className="payment-tab">Net Banking</button>
              </div>
              <label>UPI ID<input defaultValue="rohit@okaxis" /></label>
              <label className="terms-check">
                <input type="checkbox" defaultChecked />
                I accept the Terms & Conditions and Cancellation Policy
              </label>
              <a className="button-link button-link--primary" href="/payment">
                Confirm Booking & Pay →
              </a>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
