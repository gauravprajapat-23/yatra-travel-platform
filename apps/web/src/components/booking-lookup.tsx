"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Booking = {
  type: "CAR" | "PACKAGE";
  reference: string;
  status: string;
  title: string;
  route: string;
  startsAt: string;
  endsAt: string | null;
  travellers: number;
  currency: string;
  totalMinor: string;
  confirmedAt: string | null;
};

function money(minor: string, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export function BookingLookup() {
  const [reference,setReference]=useState("");
  const [email,setEmail]=useState("");
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [booking,setBooking]=useState<Booking|null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setBooking(null);

    try {
      const response=await fetch("/api/bookings/lookup",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({reference,email}),
      });
      const result=await response.json() as {booking?:Booking;error?:{message?:string}};
      if(!response.ok || !result.booking) {
        throw new Error(result.error?.message ?? "Booking not found.");
      }
      setBooking(result.booking);
    } catch(caught) {
      setError(caught instanceof Error?caught.message:"Unable to look up booking.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="shell booking-lookup booking-lookup--functional" onSubmit={submit}>
        <h2>Find Your Booking</h2>
        <p>For your privacy, enter both your booking reference and the email used during booking.</p>
        <div>
          <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Booking reference (e.g. YAT-...)" required />
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Registered email" required />
          <button className="button-link button-link--primary" type="submit" disabled={pending}>
            {pending?"Searching…":"Search Booking"}
          </button>
        </div>
        {error?<p className="lead-form-error" role="alert">{error}</p>:null}
      </form>

      {booking ? (
        <div className="shell trip-list">
          <article className="trip-list-card trip-list-card--live">
            <div className="trip-list-card__image">
              <img src={booking.type==="CAR"?"/assets/car-innova.webp":"/assets/temple-hero.webp"} alt="" />
            </div>
            <div>
              <span className="reference-badge">{booking.status.replaceAll("_"," ")}</span>
              <h2>{booking.title}</h2>
              <p>{booking.route}</p>
              <p>
                {new Date(booking.startsAt).toLocaleDateString("en-IN")}
                {booking.endsAt?` – ${new Date(booking.endsAt).toLocaleDateString("en-IN")}`:""}
                {" · "}{booking.travellers} traveller{booking.travellers===1?"":"s"}
              </p>
            </div>
            <div>
              <small>Booking ID</small>
              <strong>{booking.reference}</strong>
              <p>Amount <strong>{money(booking.totalMinor,booking.currency)}</strong></p>
              <p>Payment/booking status <span className="status-pill status-pill--green">{booking.status.replaceAll("_"," ")}</span></p>
              <div className="trip-actions">
                <Link href="/contact">Contact Support</Link>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
