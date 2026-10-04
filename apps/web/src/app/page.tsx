import { ButtonLink } from "@/components/button-link";
import { HeroJourney } from "@/components/hero-journey";
import { SectionHeading } from "@/components/section-heading";

const sacredJourneys = [
  {
    title: "Mahakaleshwar",
    meta: "Ujjain · 3 days",
    description: "A flexible temple journey centered around Mahakal darshan.",
  },
  {
    title: "Omkareshwar",
    meta: "Narmada · 2 days",
    description: "A peaceful Jyotirlinga journey with private road travel.",
  },
  {
    title: "Jyotirlinga Circuit",
    meta: "Multi-city · 6 days",
    description: "A longer sacred route planned around your preferred pace.",
  },
];

const fleet = [
  { title: "Innova Crysta", meta: "6 seats · Premium" },
  { title: "Ertiga", meta: "6 seats · Comfort" },
  { title: "Tempo Traveller", meta: "12–17 seats · Group" },
];

export default function HomePage() {
  return (
    <>
      <HeroJourney />

      <section className="booking-panel">
        <div className="shell">
          <SectionHeading title="Where do you want to go?" />
          <form action="/cars" className="trip-search" method="get">
            <label>
              <span>From</span>
              <input name="from" placeholder="Raipur" type="text" />
            </label>
            <label>
              <span>To</span>
              <input name="to" placeholder="Ujjain" type="text" />
            </label>
            <label>
              <span>Departure</span>
              <input name="departure" type="date" />
            </label>
            <label>
              <span>Return</span>
              <input name="return" type="date" />
            </label>
            <label>
              <span>Travellers</span>
              <input min="1" name="travellers" type="number" defaultValue="2" />
            </label>
            <button className="button-link button-link--primary" type="submit">
              Find Cars
            </button>
          </form>
        </div>
      </section>

      <section className="journey-choices section--dark">
        <div className="shell">
          <SectionHeading
            title="Two ways to travel beautifully."
            tone="dark"
            description="Choose the flexibility of a private car or start with a curated journey."
          />
          <div className="choice-grid">
            <article className="choice-card">
              <p className="eyebrow">BOOK A CAR</p>
              <h3>Private chauffeur-driven travel for flexible journeys.</h3>
              <ButtonLink href="/cars" variant="ghost">
                Explore Cars
              </ButtonLink>
            </article>
            <article className="choice-card">
              <p className="eyebrow">EXPLORE TOURS</p>
              <h3>Curated temple circuits and destination packages.</h3>
              <ButtonLink href="/packages" variant="ghost">
                Explore Tours
              </ButtonLink>
            </article>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="shell">
          <SectionHeading
            eyebrow="SACRED JOURNEYS"
            title="Thoughtfully planned temple travel."
            description="Comfortable travel, flexible timing and trusted drivers for meaningful pilgrimage routes."
          />
          <div className="card-grid">
            {sacredJourneys.map((journey, index) => (
              <article className="travel-card" key={journey.title}>
                <div className={`travel-card__visual travel-card__visual--${index + 1}`} />
                <p className="eyebrow">{journey.meta}</p>
                <h3>{journey.title}</h3>
                <p>{journey.description}</p>
                <ButtonLink href="/packages" variant="ghost">
                  View journey
                </ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section content-section--white">
        <div className="shell">
          <SectionHeading
            eyebrow="OUR FLEET"
            title="Cars for every kind of journey."
            description="Comfort-first vehicles selected for Indian roads, family travel and long-distance routes."
          />
          <div className="card-grid">
            {fleet.map((vehicle, index) => (
              <article className="vehicle-card" key={vehicle.title}>
                <div className={`vehicle-card__visual vehicle-card__visual--${index + 1}`}>
                  <span className="vehicle-card__car" />
                </div>
                <h3>{vehicle.title}</h3>
                <p>{vehicle.meta}</p>
                <ButtonLink href="/cars" variant="ghost">
                  View vehicle
                </ButtonLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="why-yatra">
        <div className="shell">
          <SectionHeading
            eyebrow="WHY YATRA"
            title="The journey should feel easy before it starts."
          />
          <ol className="road-timeline">
            <li>Verified Drivers</li>
            <li>Clean Cars</li>
            <li>Transparent Pricing</li>
            <li>24×7 Support</li>
            <li>Flexible Trips</li>
          </ol>
        </div>
      </section>
    </>
  );
}
