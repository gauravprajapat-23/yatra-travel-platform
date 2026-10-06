import type { Metadata } from "next";
import { CarBookingForm } from "@/components/car-booking-form";

export const metadata: Metadata = {
  title: "Car Booking",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined, fallback = ""): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function travellers(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 30 ? parsed : 1;
}

export default async function CarBookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const from = first(params.from, "Raipur").trim().slice(0, 120);
  const to = first(params.to, "Ujjain").trim().slice(0, 120);
  const departure = first(params.departure).trim().slice(0, 20);
  const returnDate = first(params.return).trim().slice(0, 20);
  const vehicleSlug = first(params.vehicle, "innova-crysta").trim().slice(0, 120);
  const count = travellers(first(params.travellers, "4"));
  const tripType =
    first(params.tripType) === "ONE_WAY" || !returnDate
      ? "ONE_WAY"
      : "ROUND_TRIP";

  return (
    <section className="reference-section reference-section--cream">
      <div className="shell stepper">
        {["Select Vehicle","Trip Details","Traveller Details","Quote","Checkout"].map((x,i)=>(
          <span className={i<=2?"stepper__step stepper__step--active":"stepper__step"} key={x}>
            {i+1}<small>{x}</small>
          </span>
        ))}
      </div>

      <div className="shell">
        <CarBookingForm
          trip={{
            from: from || "Raipur",
            to: to || "Ujjain",
            departure,
            returnDate,
            travellers: count,
            tripType,
            vehicleSlug,
          }}
        />
      </div>
    </section>
  );
}
