import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Trips", robots: { index: false, follow: false } };
const trips=[
  ["Toyota Fortuner","Raipur → Ujjain","YTR241015678","Paid","/assets/car-fortuner.webp"],
  ["Tempo Traveller","Indore → Omkareshwar","YTR241018901","Pending","/assets/fleet-hero.webp"],
];

export default function MyTripsPage(){
  return (
    <>
      <section className="story-hero story-hero--my-trips"><div className="story-hero__overlay"/><div className="shell story-hero__content"><h1>My Trips.</h1><p>Manage your bookings, download documents and get support — all in one place.</p></div></section>
      <section className="reference-section reference-section--cream">
        <div className="shell booking-lookup"><h2>Find Your Booking</h2><p>Enter your booking ID or registered phone number.</p><div><input placeholder="Booking ID or Mobile Number"/><button className="button-link button-link--primary">Search Booking</button></div></div>
        <div className="shell trip-list">
          {trips.map(([car,route,id,status,image])=><article className="trip-list-card" key={id}>
            <div className="trip-list-card__image"><img src={image} alt={`${car} for ${route}`} loading="lazy"/></div>
            <div><span className="reference-badge">Upcoming</span><h2>{car}</h2><p>{route}</p><p>12 Oct 2024 – 15 Oct 2024 · 4 Days</p></div>
            <div><small>Booking ID</small><strong>{id}</strong><p>Payment status <span className={status==="Paid"?"status-pill status-pill--green":"status-pill status-pill--yellow"}>{status}</span></p><div className="trip-actions"><button>View Details</button><button>Download Invoice</button><button>Modify Trip</button></div></div>
          </article>)}
        </div>
      </section>
    </>
  );
}
