import type { Metadata } from "next";
import { BookingLookup } from "@/components/booking-lookup";

export const metadata: Metadata = {
  title: "My Trips",
  robots: { index: false, follow: false },
};

export default function MyTripsPage(){
  return (
    <>
      <section className="story-hero story-hero--my-trips">
        <div className="story-hero__overlay"/>
        <div className="shell story-hero__content">
          <h1>My Trips.</h1>
          <p>Look up a booking securely using the booking reference and registered email.</p>
        </div>
      </section>

      <section className="reference-section reference-section--cream">
        <BookingLookup />
      </section>
    </>
  );
}
