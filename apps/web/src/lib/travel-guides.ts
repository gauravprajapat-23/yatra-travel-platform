export type TravelGuide = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  heroClass: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
};

export const travelGuides: TravelGuide[] = [
  {
    slug: "omkareshwar-travel-guide",
    title: "Omkareshwar Travel Guide",
    category: "Destinations",
    excerpt: "Plan a meaningful visit to the sacred Narmada island and Jyotirlinga temple.",
    heroClass: "asset-temple--omkareshwar",
    intro: "Omkareshwar is one of the twelve Jyotirlingas and a natural fit for a road journey combined with Ujjain or Indore.",
    sections: [
      { heading: "Best time to visit", body: "October to March is generally comfortable for road travel. Festival periods are busier, so allow extra time for darshan and local traffic." },
      { heading: "How much time to plan", body: "One to two days works well for the main temple, Narmada ghats and nearby spiritual stops. A longer circuit can include Ujjain." },
    ],
  },
  {
    slug: "raipur-to-ujjain-by-car",
    title: "Raipur to Ujjain by Car",
    category: "Road Trips",
    excerpt: "A practical guide for a private road journey from Raipur to Mahakaleshwar Ujjain.",
    heroClass: "asset-temple--ujjain",
    intro: "A chauffeur-driven road trip gives families flexibility around temple timings, rest stops and luggage.",
    sections: [
      { heading: "Plan around darshan", body: "Keep buffer time around Mahakaleshwar darshan and local temple visits. Avoid building a schedule that depends on exact road arrival times." },
      { heading: "Vehicle choice", body: "Choose a vehicle based on traveller count, luggage and trip length. Final availability and fare should be confirmed through the server quote." },
    ],
  },
  {
    slug: "rameswaram-travel-guide",
    title: "Rameswaram Travel Guide",
    category: "Destinations",
    excerpt: "Temple, coast and spiritual travel planning for Rameswaram.",
    heroClass: "asset-temple--rameswaram",
    intro: "Rameswaram combines one of India's most significant temples with a distinctive coastal landscape.",
    sections: [
      { heading: "Temple planning", body: "Temple rituals and peak-season queues can affect timing. Keep your itinerary flexible rather than packing too many distant stops into one day." },
      { heading: "Nearby experiences", body: "A well-paced trip can include coastal viewpoints and local heritage while keeping temple visits central to the journey." },
    ],
  },
  {
    slug: "best-time-to-visit-kedarnath",
    title: "Best Time to Visit Kedarnath",
    category: "Temple Guides",
    excerpt: "Understand seasonality, road conditions and planning considerations for Kedarnath.",
    heroClass: "asset-temple--kedarnath",
    intro: "Kedarnath travel is highly seasonal and requires more planning than a normal city road trip.",
    sections: [
      { heading: "Season matters", body: "Always confirm current temple opening dates, weather advisories and local access conditions before departure." },
      { heading: "Build in buffer time", body: "Mountain weather and traffic can change quickly. Avoid same-day connections that leave no recovery time." },
    ],
  },
  {
    slug: "spiritual-journey-varanasi",
    title: "A Spiritual Journey Through Varanasi",
    category: "Culture & Food",
    excerpt: "Ghats, temples and practical planning for a meaningful visit to Varanasi.",
    heroClass: "asset-destination--varanasi",
    intro: "Varanasi rewards slower travel: sunrise on the Ganges, temple visits and old-city walks are better experienced without rushing.",
    sections: [
      { heading: "Start early", body: "Sunrise boat rides and early temple visits can make the day more comfortable, especially during warmer months." },
      { heading: "Respect local rhythms", body: "Old-city lanes, religious activity and crowd patterns are part of the experience. Keep transfers flexible." },
    ],
  },
  {
    slug: "rajasthan-road-trip",
    title: "Rajasthan Road Trip",
    category: "Travel Tips",
    excerpt: "Build a comfortable private-car itinerary across Rajasthan's heritage cities.",
    heroClass: "asset-vp--rajasthan",
    intro: "Rajasthan works especially well as a multi-city private road journey when travel days are balanced with time inside each destination.",
    sections: [
      { heading: "Avoid overpacking the route", body: "Two or three major stops with enough time in each city is usually more rewarding than changing hotels every night." },
      { heading: "Choose the right vehicle", body: "Long road days make cabin comfort and luggage capacity important. Match the vehicle class to the group size and route." },
    ],
  },
];

export function findTravelGuide(slug: string): TravelGuide | undefined {
  return travelGuides.find((guide) => guide.slug === slug);
}
