import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const client = new Client({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? undefined
    : { rejectUnauthorized: false },
});

const now = new Date();
const publishedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);

function json(value) {
  return JSON.stringify(value);
}

function addDays(days, hour = 7, minute = 0) {
  const value = new Date(now);
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, minute, 0, 0);
  return value;
}

function packageBody(id, intro, highlights) {
  return [
    {
      id: id + "-intro",
      type: "paragraph",
      data: { text: intro },
    },
    {
      id: id + "-highlights",
      type: "heading",
      data: { text: "Journey highlights", level: 2 },
    },
    {
      id: id + "-list",
      type: "routeHighlights",
      data: { items: highlights },
    },
    {
      id: id + "-note",
      type: "callout",
      data: {
        title: "Before you travel",
        text: "Temple entry rules, darshan timings and local road conditions can change. The operations team reconfirms current timings before departure.",
      },
    },
  ];
}

function destinationBody(id, paragraphs, highlights = []) {
  return [
    ...paragraphs.map((text, index) => ({
      id: id + "-p-" + (index + 1),
      type: "paragraph",
      data: { text },
    })),
    ...(highlights.length
      ? [{
          id: id + "-highlights",
          type: "list",
          data: { items: highlights },
        }]
      : []),
  ];
}

const media = [
  ["catalog-media-temple", "catalog/temple-hero.webp", "/assets/temple-hero.webp", "Sacred temple journey in India"],
  ["catalog-media-packages", "catalog/packages-hero.webp", "/assets/packages-hero.webp", "Curated India tour package"],
  ["catalog-media-home", "catalog/home-hero.webp", "/assets/home-hero.webp", "Scenic India road journey"],
  ["catalog-media-innova", "catalog/car-innova.webp", "/assets/car-innova.webp", "Toyota Innova Crysta"],
  ["catalog-media-ertiga", "catalog/car-ertiga.webp", "/assets/car-ertiga.webp", "Maruti Suzuki Ertiga"],
  ["catalog-media-fortuner", "catalog/car-fortuner.webp", "/assets/car-fortuner.webp", "Toyota Fortuner"],
];

const destinations = [
  {
    id: "catalog-dest-ujjain",
    slug: "ujjain",
    name: "Ujjain",
    kind: "TEMPLE",
    featured: true,
    mediaId: "catalog-media-temple",
    summary: "A sacred Madhya Pradesh city centred on Mahakaleshwar Jyotirlinga, the Shipra river and a deep Shaiva tradition.",
    body: destinationBody("ujjain", [
      "Ujjain is one of India’s ancient pilgrimage cities and a practical road-trip destination from Indore and Bhopal.",
      "A private-car itinerary can combine Mahakaleshwar, the old city, Shipra river ghats and nearby spiritual sites without rushing the day.",
    ], ["Mahakaleshwar Jyotirlinga", "Shipra river ghats", "Kal Bhairav temple circuit", "Easy road access from Indore"]),
    seoTitle: "Ujjain Tour & Mahakaleshwar Trip by Car",
    seoDescription: "Plan a private chauffeur-driven Ujjain and Mahakaleshwar journey with flexible pickup from Madhya Pradesh.",
    temple: {
      templeName: "Shri Mahakaleshwar Jyotirlinga",
      deity: "Shiva",
      darshanNotes: "Darshan procedures and special-entry arrangements can change on festival and high-crowd days. Confirm the current official temple process before travel.",
      dressCode: "Dress modestly and follow the temple administration’s current rules for specific rituals or entry areas.",
      openingHours: { note: "Temple timings vary by ritual schedule and festival calendar; reconfirm before departure." },
      nearbyPlaces: ["Kal Bhairav Temple", "Harsiddhi Mata Temple", "Ram Ghat", "Mangalnath Temple"],
      practicalNotes: ["Allow extra time on Mondays, Shravan dates and major festivals.", "Early arrival is recommended for a calmer city transfer."],
    },
  },
  {
    id: "catalog-dest-omkareshwar",
    slug: "omkareshwar",
    name: "Omkareshwar",
    kind: "TEMPLE",
    featured: true,
    mediaId: "catalog-media-temple",
    summary: "A Narmada river pilgrimage destination known for Omkareshwar Jyotirlinga and its island temple setting.",
    body: destinationBody("omkareshwar", [
      "Omkareshwar is well suited to a day trip or overnight spiritual journey from Indore.",
      "The experience combines road travel, river views and temple access, so comfortable walking shoes and realistic transfer time are useful.",
    ]),
    seoTitle: "Omkareshwar Jyotirlinga Tour by Car",
    seoDescription: "Private Omkareshwar road trips with chauffeur-driven cars from Indore, Ujjain and nearby cities.",
    temple: {
      templeName: "Shri Omkareshwar Jyotirlinga",
      deity: "Shiva",
      darshanNotes: "Access and queue arrangements vary with crowd levels. Reconfirm current local arrangements before travel.",
      dressCode: "Modest temple-appropriate clothing is recommended.",
      openingHours: { note: "Temple and aarti schedules can change; verify the current official timings before the trip." },
      nearbyPlaces: ["Mamleshwar Temple", "Narmada ghats", "Island parikrama route"],
      practicalNotes: ["Expect walking and steps around temple/ghat areas.", "Monsoon river conditions can affect local movement."],
    },
  },
  {
    id: "catalog-dest-indore",
    slug: "indore",
    name: "Indore",
    kind: "CITY",
    featured: true,
    mediaId: "catalog-media-home",
    summary: "Madhya Pradesh’s largest city and a convenient base for Ujjain, Omkareshwar and Maheshwar road journeys.",
    body: destinationBody("indore", [
      "Indore works well as an arrival hub for central Madhya Pradesh because it connects easily with major pilgrimage and heritage circuits.",
      "Travellers can use the city for airport or railway pickup, an overnight stop, food exploration and onward private-car journeys.",
    ], ["Gateway to Ujjain", "Gateway to Omkareshwar", "Rajwada and old-city areas", "Convenient airport pickup"]),
    seoTitle: "Indore Private Car Tours & Airport Transfers",
    seoDescription: "Book chauffeur-driven Indore transfers and private road trips to Ujjain, Omkareshwar, Maheshwar and Mandu.",
  },
  {
    id: "catalog-dest-maheshwar",
    slug: "maheshwar",
    name: "Maheshwar",
    kind: "HERITAGE",
    featured: true,
    mediaId: "catalog-media-home",
    summary: "A heritage town on the Narmada known for Ahilya Fort, river ghats, temples and Maheshwari weaving.",
    body: destinationBody("maheshwar", [
      "Maheshwar is a relaxed heritage stop that pairs naturally with Omkareshwar or Indore.",
      "The fort-and-ghat area rewards an unhurried visit, particularly around the riverfront and old lanes.",
    ], ["Ahilya Fort", "Narmada ghats", "Historic temples", "Maheshwari handloom tradition"]),
    seoTitle: "Maheshwar Heritage Tour by Private Car",
    seoDescription: "Plan a private Maheshwar heritage trip with Narmada ghats, Ahilya Fort and comfortable chauffeur-driven travel.",
  },
  {
    id: "catalog-dest-mandu",
    slug: "mandu",
    name: "Mandu",
    kind: "HERITAGE",
    featured: false,
    mediaId: "catalog-media-home",
    summary: "A hilltop heritage destination with Afghan-era architecture, lakes and broad plateau views.",
    body: destinationBody("mandu", [
      "Mandu is one of Madhya Pradesh’s most rewarding heritage drives and can be combined with Maheshwar for a two-day circuit.",
      "Because the monuments are spread out, a private vehicle makes it easier to cover the main sites at a comfortable pace.",
    ], ["Jahaz Mahal", "Hindola Mahal", "Rani Roopmati Pavilion", "Baz Bahadur’s Palace"]),
    seoTitle: "Mandu Heritage Tour by Car",
    seoDescription: "Explore Mandu’s monuments and plateau views with a private chauffeur-driven vehicle from Indore.",
  },
  {
    id: "catalog-dest-bhopal",
    slug: "bhopal",
    name: "Bhopal",
    kind: "CITY",
    featured: true,
    mediaId: "catalog-media-home",
    summary: "The capital of Madhya Pradesh, with lakes, museums and convenient road access to Sanchi, Bhimbetka and Ujjain.",
    body: destinationBody("bhopal", [
      "Bhopal is a strong starting point for heritage, archaeology and central India road trips.",
      "A private-car stay can combine city sightseeing with Sanchi or Bhimbetka while keeping airport and railway transfers simple.",
    ], ["Upper Lake", "Tribal Museum", "Sanchi day trip", "Bhimbetka day trip"]),
    seoTitle: "Bhopal Private Car Tours & Transfers",
    seoDescription: "Chauffeur-driven Bhopal city transfers and private day trips to Sanchi, Bhimbetka and Ujjain.",
  },
  {
    id: "catalog-dest-sanchi",
    slug: "sanchi",
    name: "Sanchi",
    kind: "HERITAGE",
    featured: false,
    mediaId: "catalog-media-home",
    summary: "A major Buddhist heritage site near Bhopal, best known for its ancient stupas and archaeological complex.",
    body: destinationBody("sanchi", [
      "Sanchi is an easy heritage excursion from Bhopal and is often paired with nearby archaeological or museum stops.",
      "A half-day to full-day private-car plan gives enough flexibility for the site and return journey.",
    ]),
    seoTitle: "Sanchi Day Trip from Bhopal by Car",
    seoDescription: "Plan a private Sanchi heritage day trip from Bhopal with chauffeur-driven transport.",
  },
  {
    id: "catalog-dest-varanasi",
    slug: "varanasi",
    name: "Varanasi",
    kind: "TEMPLE",
    featured: true,
    mediaId: "catalog-media-temple",
    summary: "One of India’s most significant spiritual cities, known for Kashi Vishwanath, Ganga ghats and old-city lanes.",
    body: destinationBody("varanasi", [
      "Varanasi rewards careful planning because temple visits, old-city walking and riverfront experiences operate on very different rhythms.",
      "Private transfers are most useful for airport/railway movement and excursions beyond the dense old city.",
    ], ["Kashi Vishwanath corridor", "Ganga ghats", "Sarnath excursion", "Sunrise and evening riverfront experiences"]),
    seoTitle: "Varanasi Spiritual Tour & Private Transfers",
    seoDescription: "Plan a Varanasi spiritual journey with private transfers, temple-focused itineraries and Sarnath excursions.",
    temple: {
      templeName: "Shri Kashi Vishwanath Temple",
      deity: "Shiva",
      darshanNotes: "Security, permitted-item and entry procedures are strictly controlled and can change. Follow the temple administration’s current official guidance.",
      dressCode: "Wear modest clothing suitable for temple entry.",
      openingHours: { note: "Darshan and aarti schedules vary; verify official timings before travel." },
      nearbyPlaces: ["Dashashwamedh Ghat", "Assi Ghat", "Sarnath", "Kal Bhairav Temple"],
      practicalNotes: ["Old-city access often requires walking.", "Keep extra buffer for security and crowds."],
    },
  },
];

const vehicleClasses = [
  ["catalog-class-mpv", "premium-mpv", "Premium MPV", "Comfort-focused family and pilgrimage travel for up to 6 passengers.", 6, 4, 10],
  ["catalog-class-muv", "value-muv", "Value MUV", "Practical air-conditioned multi-utility vehicle for small groups.", 6, 3, 20],
  ["catalog-class-suv", "premium-suv", "Premium SUV", "Premium SUV for private road journeys and executive travel.", 6, 4, 30],
];

const vehicles = [
  {
    id: "catalog-vehicle-innova",
    slug: "toyota-innova-crysta",
    registration: "CATALOG-INNOVA-01",
    name: "Toyota Innova Crysta",
    classId: "catalog-class-mpv",
    seats: 6,
    luggage: 4,
    featured: true,
    mediaId: "catalog-media-innova",
    features: ["Air conditioning", "Captain-seat configuration", "Large luggage space", "Long-distance comfort"],
    description: "A preferred choice for family, pilgrimage and multi-day highway trips with generous cabin and luggage space.",
  },
  {
    id: "catalog-vehicle-ertiga",
    slug: "maruti-suzuki-ertiga",
    registration: "CATALOG-ERTIGA-01",
    name: "Maruti Suzuki Ertiga",
    classId: "catalog-class-muv",
    seats: 6,
    luggage: 3,
    featured: true,
    mediaId: "catalog-media-ertiga",
    features: ["Air conditioning", "Flexible seating", "Efficient city and highway travel"],
    description: "A practical value option for airport transfers, pilgrimage routes and small-family road trips.",
  },
  {
    id: "catalog-vehicle-fortuner",
    slug: "toyota-fortuner",
    registration: "CATALOG-FORTUNER-01",
    name: "Toyota Fortuner",
    classId: "catalog-class-suv",
    seats: 6,
    luggage: 4,
    featured: true,
    mediaId: "catalog-media-fortuner",
    features: ["Air conditioning", "Premium SUV cabin", "Highway touring", "Extra ground clearance"],
    description: "A premium SUV option for travellers who prefer a commanding seating position and upscale road-trip experience.",
  },
];

const packages = [
  {
    id: "catalog-package-jyotirlinga-mp",
    slug: "ujjain-omkareshwar-jyotirlinga",
    title: "Ujjain & Omkareshwar Jyotirlinga Journey",
    summary: "A 3-day private spiritual circuit from Indore covering Mahakaleshwar, Omkareshwar and key local temples.",
    days: 3,
    nights: 2,
    mediaId: "catalog-media-packages",
    destinations: ["catalog-dest-indore", "catalog-dest-ujjain", "catalog-dest-omkareshwar"],
    price: 899900,
    itinerary: [
      ["Indore arrival & Ujjain", "Pickup in Indore, drive to Ujjain, hotel check-in and evening temple/ghat time."],
      ["Mahakaleshwar & Omkareshwar", "Early Ujjain temple plan followed by a private drive to Omkareshwar and Narmada-side visit."],
      ["Omkareshwar to Indore", "Morning local visit, relaxed return to Indore and drop at airport/railway station."],
    ],
    body: packageBody("mp-jyotirlinga", "Designed for travellers who want the two major Madhya Pradesh Jyotirlinga destinations in one private-car itinerary without an overnight rush.", ["Private chauffeur-driven vehicle", "Indore pickup and drop", "Ujjain and Omkareshwar circuit", "Flexible temple timing buffers"]),
  },
  {
    id: "catalog-package-malway-heritage",
    slug: "indore-maheshwar-mandu",
    title: "Indore, Maheshwar & Mandu Heritage Escape",
    summary: "A relaxed 3-day central India circuit combining Indore, Narmada-side Maheshwar and Mandu’s hilltop monuments.",
    days: 3,
    nights: 2,
    mediaId: "catalog-media-packages",
    destinations: ["catalog-dest-indore", "catalog-dest-maheshwar", "catalog-dest-mandu"],
    price: 949900,
    itinerary: [
      ["Indore arrival", "Private pickup and a flexible Indore city introduction based on arrival time."],
      ["Maheshwar & Mandu", "Drive to Maheshwar for fort and ghats, then continue toward Mandu for the heritage circuit."],
      ["Mandu to Indore", "Morning monuments and viewpoints followed by return transfer to Indore."],
    ],
    body: packageBody("malwa-heritage", "A private road journey for travellers who want architecture, riverfront heritage and a slower central India experience.", ["Ahilya Fort and Narmada ghats", "Mandu monuments", "Private vehicle throughout", "Flexible photography and meal stops"]),
  },
  {
    id: "catalog-package-bhopal-heritage",
    slug: "bhopal-sanchi-heritage",
    title: "Bhopal & Sanchi Heritage Journey",
    summary: "A 2-day private trip combining Bhopal highlights with the Buddhist heritage complex at Sanchi.",
    days: 2,
    nights: 1,
    mediaId: "catalog-media-packages",
    destinations: ["catalog-dest-bhopal", "catalog-dest-sanchi"],
    price: 599900,
    itinerary: [
      ["Bhopal", "Pickup, city sightseeing and a flexible museum/lake plan depending on operating hours."],
      ["Sanchi excursion", "Private drive to Sanchi, heritage visit and return transfer to Bhopal."],
    ],
    body: packageBody("bhopal-sanchi", "A compact cultural journey designed around Bhopal city time and an unhurried Sanchi excursion.", ["Private city transfers", "Sanchi excursion", "Bhopal pickup/drop", "Flexible schedule"]),
  },
  {
    id: "catalog-package-varanasi",
    slug: "varanasi-spiritual-journey",
    title: "Varanasi Spiritual Journey",
    summary: "A 3-day Varanasi plan with private transfers, ghats, Kashi-focused time and a Sarnath excursion.",
    days: 3,
    nights: 2,
    mediaId: "catalog-media-packages",
    destinations: ["catalog-dest-varanasi"],
    price: 1099900,
    itinerary: [
      ["Arrival & riverfront", "Private arrival transfer and evening riverfront plan based on arrival time and crowd conditions."],
      ["Kashi & ghats", "Temple-focused morning, old-city walking time and flexible ghat exploration."],
      ["Sarnath & departure", "Private Sarnath excursion followed by airport or railway transfer."],
    ],
    body: packageBody("varanasi-spiritual", "A balanced Varanasi itinerary that separates vehicle transfers from old-city walking so the trip remains realistic and comfortable.", ["Private airport/railway transfers", "Temple and ghat planning", "Sarnath excursion", "Local timing buffers"]),
  },
  {
    id: "catalog-package-mp-spiritual",
    slug: "madhya-pradesh-spiritual-circuit",
    title: "Madhya Pradesh Spiritual Circuit",
    summary: "A 5-day chauffeur-driven journey linking Bhopal, Ujjain, Omkareshwar, Maheshwar and Indore.",
    days: 5,
    nights: 4,
    mediaId: "catalog-media-packages",
    destinations: ["catalog-dest-bhopal", "catalog-dest-ujjain", "catalog-dest-omkareshwar", "catalog-dest-maheshwar", "catalog-dest-indore"],
    price: 1699900,
    itinerary: [
      ["Bhopal arrival", "Arrival transfer, city orientation and overnight in Bhopal."],
      ["Bhopal to Ujjain", "Drive to Ujjain with flexible breaks and evening spiritual-city experience."],
      ["Ujjain to Omkareshwar", "Temple-focused morning followed by road transfer to Omkareshwar."],
      ["Omkareshwar & Maheshwar", "Narmada circuit with Maheshwar fort and ghats before continuing toward Indore."],
      ["Indore departure", "Flexible Indore time followed by airport or railway drop."],
    ],
    body: packageBody("mp-spiritual", "A longer central India circuit for travellers who want major spiritual destinations with practical overnight spacing instead of overnight road rushing.", ["Five-day private vehicle", "Two Jyotirlinga destinations", "Narmada heritage stop", "Bhopal-to-Indore routing"]),
  },
];

const seoGuides = [
  {
    id: "catalog-guide-ujjain-mahakaleshwar",
    slug: "ujjain-mahakaleshwar-travel-guide",
    title: "Ujjain Mahakaleshwar Travel Guide: Planning a Comfortable Temple Journey",
    excerpt: "How to plan a private Ujjain and Mahakaleshwar trip with realistic temple buffers, local sightseeing and road travel from Indore or Bhopal.",
    category: "Temple Travel",
    seoTitle: "Ujjain Mahakaleshwar Travel Guide & Private Car Planning",
    seoDescription: "Plan a Ujjain Mahakaleshwar journey with temple timing buffers, private-car travel, nearby spiritual stops and practical trip planning.",
    mediaId: "catalog-media-temple",
    body: [
      { id: "ujjain-guide-intro", type: "paragraph", data: { text: "Ujjain is one of central India's most important spiritual destinations, and Mahakaleshwar Jyotirlinga is the centre of most pilgrimage itineraries. A comfortable plan should leave room for temple security, queues, local traffic and changing ritual schedules instead of treating the city like a fixed-hour sightseeing stop." } },
      { id: "ujjain-guide-plan-h", type: "heading", data: { text: "How to plan the journey", level: 2 } },
      { id: "ujjain-guide-plan", type: "list", data: { items: ["Use Indore or Bhopal as a practical arrival point depending on your wider itinerary.", "Keep the Mahakaleshwar visit flexible because crowd levels vary by weekday, festival and ritual schedule.", "Add Harsiddhi Mata Temple, Ram Ghat, Kal Bhairav and Mangalnath only when the day has enough buffer.", "For families or senior travellers, avoid stacking a long road transfer immediately after a crowded temple visit."] } },
      { id: "ujjain-guide-car-h", type: "heading", data: { text: "Why a private chauffeur-driven car helps", level: 2 } },
      { id: "ujjain-guide-car", type: "paragraph", data: { text: "A private vehicle is useful when your trip combines Ujjain with Indore, Omkareshwar or Maheshwar. It keeps luggage, hotel transfers and intercity travel in one plan while allowing the temple portion of the day to stay flexible." } },
      { id: "ujjain-guide-cta", type: "cta", data: { label: "Explore Ujjain & Omkareshwar Tour", href: "/packages/ujjain-omkareshwar-jyotirlinga", text: "See the published multi-day Jyotirlinga itinerary and current departure options." } }
    ],
  },
  {
    id: "catalog-guide-omkareshwar-indore",
    slug: "omkareshwar-from-indore-private-car-guide",
    title: "Omkareshwar from Indore: Private Car Trip Planning Guide",
    excerpt: "A practical guide to planning an Omkareshwar Jyotirlinga road journey from Indore with temple, riverfront and return-trip considerations.",
    category: "Road Trips",
    seoTitle: "Omkareshwar from Indore by Car: Trip Planning Guide",
    seoDescription: "Plan an Indore to Omkareshwar private-car trip with realistic temple buffers, Narmada-side walking time and flexible return travel.",
    mediaId: "catalog-media-temple",
    body: [
      { id: "om-guide-intro", type: "paragraph", data: { text: "Omkareshwar is a natural road-trip choice from Indore for travellers who want a Jyotirlinga visit without changing transport multiple times. The destination combines temple access, walking, steps and riverfront movement, so the itinerary should allow more time than the road transfer alone suggests." } },
      { id: "om-guide-day-h", type: "heading", data: { text: "A realistic day-trip structure", level: 2 } },
      { id: "om-guide-day", type: "list", data: { items: ["Leave enough time for traffic and a calm arrival rather than planning around a single exact temple-entry minute.", "Keep footwear and luggage practical because the temple and ghat areas involve walking.", "Check local river and monsoon conditions before relying on any optional river-related activity.", "If combining Omkareshwar with Maheshwar, consider an overnight or a slower two-day plan instead of compressing both destinations."] } },
      { id: "om-guide-cta", type: "cta", data: { label: "View Omkareshwar Destination Guide", href: "/destinations/omkareshwar", text: "Review the published destination notes before building your route." } }
    ],
  },
  {
    id: "catalog-guide-bhopal-ujjain",
    slug: "bhopal-to-ujjain-car-travel-guide",
    title: "Bhopal to Ujjain by Car: What to Plan Before Your Journey",
    excerpt: "Planning notes for a chauffeur-driven Bhopal to Ujjain road trip, including temple timing, comfort stops and onward Madhya Pradesh circuits.",
    category: "Road Trips",
    seoTitle: "Bhopal to Ujjain by Car: Chauffeur-Driven Travel Guide",
    seoDescription: "Plan a Bhopal to Ujjain private-car journey with temple timing buffers, comfortable road breaks and onward options to Indore or Omkareshwar.",
    mediaId: "catalog-media-home",
    body: [
      { id: "bhopal-ujjain-intro", type: "paragraph", data: { text: "A Bhopal to Ujjain road journey works well for families and spiritual travellers who want direct door-to-door travel without changing trains or local vehicles. The best itinerary depends on whether Ujjain is the final destination or the first stop in a longer Madhya Pradesh circuit." } },
      { id: "bhopal-ujjain-plan-h", type: "heading", data: { text: "Plan around the purpose of the trip", level: 2 } },
      { id: "bhopal-ujjain-plan", type: "paragraph", data: { text: "If Mahakaleshwar is the main purpose, schedule enough buffer after arrival before important temple activities. If the trip continues to Indore or Omkareshwar, use Ujjain as a proper stop instead of treating it as a quick roadside visit." } },
      { id: "bhopal-ujjain-vehicle-h", type: "heading", data: { text: "Choosing the vehicle", level: 2 } },
      { id: "bhopal-ujjain-vehicle", type: "paragraph", data: { text: "For small groups, luggage volume and passenger comfort matter more than choosing the largest vehicle. An MPV such as an Innova Crysta is often suitable for longer family journeys, while a value MUV can work well for lighter luggage and smaller budgets." } },
      { id: "bhopal-ujjain-cta", type: "cta", data: { label: "Explore Chauffeur-Driven Cars", href: "/cars", text: "Compare the active YATRA fleet before requesting a server-verified quote." } }
    ],
  },
  {
    id: "catalog-guide-maheshwar-mandu",
    slug: "maheshwar-mandu-road-trip-itinerary",
    title: "Maheshwar and Mandu Road Trip: A Relaxed Heritage Itinerary",
    excerpt: "How to combine Maheshwar's Narmada riverfront with Mandu's hilltop monuments in a comfortable private road itinerary.",
    category: "Heritage Travel",
    seoTitle: "Maheshwar & Mandu Road Trip Itinerary by Private Car",
    seoDescription: "Plan a Maheshwar and Mandu private-car itinerary with Narmada ghats, Ahilya Fort and Mandu's major heritage monuments.",
    mediaId: "catalog-media-home",
    body: [
      { id: "maheshwar-mandu-intro", type: "paragraph", data: { text: "Maheshwar and Mandu complement each other well: one is centred on the Narmada riverfront, fort and temple landscape, while the other spreads across a large hilltop heritage zone. A private-car itinerary lets you move between the two without rushing the walking portions of either destination." } },
      { id: "maheshwar-mandu-order-h", type: "heading", data: { text: "A practical two-stop sequence", level: 2 } },
      { id: "maheshwar-mandu-order", type: "list", data: { items: ["Give Maheshwar enough time for Ahilya Fort, the ghats and old-town exploration.", "Keep Mandu for a separate half-day or full-day block because the monuments are geographically spread out.", "During hotter months, move the most exposed monument visits away from the harshest part of the day.", "Use Indore as a convenient arrival or departure base when the trip is part of a broader central India circuit."] } },
      { id: "maheshwar-mandu-cta", type: "cta", data: { label: "View Maheshwar & Mandu Tour", href: "/packages/indore-maheshwar-mandu", text: "See the published three-day heritage route." } }
    ],
  },
  {
    id: "catalog-guide-varanasi",
    slug: "varanasi-spiritual-trip-planning-guide",
    title: "Varanasi Spiritual Trip Planning Guide: Temples, Ghats and Transfers",
    excerpt: "Plan a Varanasi spiritual journey by separating old-city walking, temple time, riverfront experiences and private transfers.",
    category: "Temple Travel",
    seoTitle: "Varanasi Spiritual Trip Guide: Temples, Ghats & Transfers",
    seoDescription: "Plan a Varanasi spiritual journey with realistic temple buffers, ghat time, Sarnath excursions and private airport or railway transfers.",
    mediaId: "catalog-media-temple",
    body: [
      { id: "varanasi-guide-intro", type: "paragraph", data: { text: "Varanasi is best planned as several different travel experiences rather than one continuous car itinerary. Private transport is especially useful for airport or railway transfers and Sarnath, while many old-city and ghat experiences involve walking." } },
      { id: "varanasi-guide-plan-h", type: "heading", data: { text: "Separate vehicle time from old-city time", level: 2 } },
      { id: "varanasi-guide-plan", type: "list", data: { items: ["Allow extra time for Kashi Vishwanath security and current entry procedures.", "Treat ghat exploration as a walking-first activity and keep vehicle pickup points flexible.", "Use a separate block for Sarnath instead of squeezing it between temple visits.", "Reconfirm current temple, aarti and local access rules close to the travel date."] } },
      { id: "varanasi-guide-cta", type: "cta", data: { label: "Explore Varanasi Spiritual Journey", href: "/packages/varanasi-spiritual-journey", text: "See YATRA's published three-day Varanasi itinerary." } }
    ],
  },
];

const legalPages = [
  {
    id: "catalog-cms-privacy-policy",
    slug: "privacy-policy",
    title: "Privacy Policy",
    excerpt: "How YATRA collects, uses and protects information when you use our travel website and booking services.",
    seoTitle: "Privacy Policy",
    seoDescription: "Read how YATRA handles account, booking, payment, enquiry and website usage information.",
    body: [
      { id: "privacy-intro", type: "paragraph", data: { text: "This Privacy Policy explains how YATRA collects, uses, stores and shares information when you browse our website, submit an enquiry, create an account or make a booking." } },
      { id: "privacy-collect-h", type: "heading", data: { text: "Information we collect", level: 2 } },
      { id: "privacy-collect", type: "list", data: { items: ["Contact details such as name, email address and phone number.", "Trip, traveller and booking information you submit.", "Payment status and provider references; YATRA does not store full card details.", "Account and authentication information when customer accounts are enabled.", "Security, device and technical information needed to protect the service and prevent abuse.", "Optional analytics information only after you accept analytics cookies." ] } },
      { id: "privacy-use-h", type: "heading", data: { text: "How we use information", level: 2 } },
      { id: "privacy-use", type: "paragraph", data: { text: "We use information to respond to enquiries, prepare and manage travel services, process bookings and payments, provide customer support, secure the platform, meet legal obligations and improve the service." } },
      { id: "privacy-sharing-h", type: "heading", data: { text: "Sharing and service providers", level: 2 } },
      { id: "privacy-sharing", type: "paragraph", data: { text: "We share information only when necessary with service providers involved in operating the platform or fulfilling a requested service, such as payment, email, hosting, storage or travel operations providers. We do not sell personal information." } },
      { id: "privacy-retention-h", type: "heading", data: { text: "Retention and security", level: 2 } },
      { id: "privacy-retention", type: "paragraph", data: { text: "We retain information only for as long as reasonably necessary for service delivery, legal, accounting, fraud-prevention and dispute-resolution purposes. We use access controls, encryption where appropriate and operational safeguards to protect information." } },
      { id: "privacy-cookies-h", type: "heading", data: { text: "Cookies and analytics", level: 2 } },
      { id: "privacy-cookies", type: "paragraph", data: { text: "Essential browser storage may be used for core functionality. Optional analytics does not load until you choose to accept analytics in the cookie banner. You can keep essential-only mode." } },
      { id: "privacy-rights-h", type: "heading", data: { text: "Your choices", level: 2 } },
      { id: "privacy-rights", type: "paragraph", data: { text: "You may contact YATRA to ask about your personal information, request corrections or raise a privacy concern. Some records may need to be retained where required for legal, security or transaction purposes." } },
      { id: "privacy-contact", type: "cta", data: { label: "Contact YATRA", href: "/contact", text: "For privacy questions or requests, contact our support team." } }
    ],
  },
  {
    id: "catalog-cms-terms",
    slug: "terms",
    title: "Terms & Conditions",
    excerpt: "The terms that apply when you use YATRA, request travel services or make a booking.",
    seoTitle: "Terms & Conditions",
    seoDescription: "Read the terms governing YATRA enquiries, quotes, bookings, payments, cancellations and travel services.",
    body: [
      { id: "terms-intro", type: "paragraph", data: { text: "These Terms & Conditions apply to your use of the YATRA website and to enquiries, quotes and bookings made through the service." } },
      { id: "terms-quotes-h", type: "heading", data: { text: "Quotes and availability", level: 2 } },
      { id: "terms-quotes", type: "paragraph", data: { text: "Quotes are based on the route, dates, travellers, vehicle class, pricing rules and availability shown at the time of quotation. A trip is not confirmed until the required booking and payment steps are completed and confirmation is issued." } },
      { id: "terms-pricing-h", type: "heading", data: { text: "Pricing and additional charges", level: 2 } },
      { id: "terms-pricing", type: "paragraph", data: { text: "The checkout breakdown controls the booked price. Approved itinerary changes, additional distance or time, tolls, parking, permits, taxes, night allowances or third-party charges may apply where they are not included in the original quote." } },
      { id: "terms-travel-h", type: "heading", data: { text: "Travel conditions", level: 2 } },
      { id: "terms-travel", type: "paragraph", data: { text: "Travel times and itineraries may be affected by weather, road closures, traffic, government restrictions, temple rules, local operating hours or other circumstances outside YATRA's reasonable control. Safety-related route or vehicle decisions may be made when necessary." } },
      { id: "terms-cancel-h", type: "heading", data: { text: "Cancellations and refunds", level: 2 } },
      { id: "terms-cancel", type: "paragraph", data: { text: "Cancellation and refund eligibility is governed by the booking policy accepted during checkout and any specific package or provider terms shown before payment." } },
      { id: "terms-conduct-h", type: "heading", data: { text: "Acceptable use", level: 2 } },
      { id: "terms-conduct", type: "paragraph", data: { text: "You must provide accurate information, use the service lawfully and not attempt to abuse, disrupt or gain unauthorised access to the platform, accounts, payment flows or operational systems." } },
      { id: "terms-contact", type: "cta", data: { label: "Contact YATRA", href: "/contact", text: "If you have questions about these terms before booking, contact our support team." } }
    ],
  },
];

const faqs = [
  ["catalog-faq-booking-1", "BOOKING", "Can I book a car without creating an account?", "Yes. Guest car booking is supported. Keep your booking reference and the email used during checkout to retrieve the trip later.", 10],
  ["catalog-faq-vehicle-1", "VEHICLES", "Is the exact car model guaranteed?", "The selected vehicle is recorded when available. Operational substitutions, if ever required, should be to an equivalent or higher suitable class and confirmed with the traveller.", 20],
  ["catalog-faq-package-1", "PACKAGES", "Are temple darshan tickets included in package prices?", "Unless a package explicitly states otherwise, temple tickets, special darshan, puja charges and government entry fees are not automatically included.", 30],
  ["catalog-faq-pricing-1", "PRICING", "What can change the final car fare?", "Route changes, additional kilometres, extra days, tolls or parking where excluded, night allowances and requested itinerary changes can affect the final amount. The quote breakdown should be reviewed before payment.", 40],
  ["catalog-faq-cancel-1", "CANCELLATION", "How are cancellations and refunds handled?", "Cancellation eligibility follows the booking policy accepted at checkout. Approved refunds are returned through the configured payment provider and can take additional banking time to appear.", 50],
];

await client.connect();

try {
  await client.query("BEGIN");

  for (const [id, objectKey, publicUrl, altText] of media) {
    await client.query(
      `INSERT INTO "MediaAsset"
        ("id","storageProvider","objectKey","publicUrl","mimeType","altText","createdAt","updatedAt")
       VALUES ($1,'local',$2,$3,'image/webp',$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET
         "objectKey"=EXCLUDED."objectKey",
         "publicUrl"=EXCLUDED."publicUrl",
         "mimeType"=EXCLUDED."mimeType",
         "altText"=EXCLUDED."altText",
         "updatedAt"=CURRENT_TIMESTAMP`,
      [id, objectKey, publicUrl, altText],
    );
  }

  for (const item of destinations) {
    await client.query(
      `INSERT INTO "Destination"
        ("id","slug","name","kind","summary","body","status","isFeatured","publishedAt","heroMediaId",
         "seoTitle","seoDescription","robotsIndex","robotsFollow","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4::"DestinationKind",$5,$6::jsonb,'PUBLISHED'::"ContentStatus",$7,$8,$9,$10,$11,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("slug") DO UPDATE SET
         "name"=EXCLUDED."name",
         "kind"=EXCLUDED."kind",
         "summary"=EXCLUDED."summary",
         "body"=EXCLUDED."body",
         "status"='PUBLISHED'::"ContentStatus",
         "isFeatured"=EXCLUDED."isFeatured",
         "publishedAt"=EXCLUDED."publishedAt",
         "heroMediaId"=EXCLUDED."heroMediaId",
         "seoTitle"=EXCLUDED."seoTitle",
         "seoDescription"=EXCLUDED."seoDescription",
         "robotsIndex"=true,
         "robotsFollow"=true,
         "updatedAt"=CURRENT_TIMESTAMP`,
      [item.id, item.slug, item.name, item.kind, item.summary, json(item.body), item.featured, publishedAt, item.mediaId, item.seoTitle, item.seoDescription],
    );

    if (item.temple) {
      const dest = await client.query(`SELECT "id" FROM "Destination" WHERE "slug"=$1`, [item.slug]);
      const destinationId = dest.rows[0].id;
      await client.query(
        `INSERT INTO "TempleProfile"
          ("id","destinationId","templeName","deity","darshanNotes","dressCode","openingHours","nearbyPlaces","practicalNotes","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("destinationId") DO UPDATE SET
           "templeName"=EXCLUDED."templeName",
           "deity"=EXCLUDED."deity",
           "darshanNotes"=EXCLUDED."darshanNotes",
           "dressCode"=EXCLUDED."dressCode",
           "openingHours"=EXCLUDED."openingHours",
           "nearbyPlaces"=EXCLUDED."nearbyPlaces",
           "practicalNotes"=EXCLUDED."practicalNotes",
           "updatedAt"=CURRENT_TIMESTAMP`,
        ["catalog-temple-" + item.slug, destinationId, item.temple.templeName, item.temple.deity, item.temple.darshanNotes, item.temple.dressCode, json(item.temple.openingHours), json(item.temple.nearbyPlaces), json(item.temple.practicalNotes)],
      );
    }
  }

  for (const row of vehicleClasses) {
    await client.query(
      `INSERT INTO "VehicleClass"
        ("id","slug","name","description","defaultSeats","defaultLuggage","isActive","sortOrder","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("slug") DO UPDATE SET
         "name"=EXCLUDED."name",
         "description"=EXCLUDED."description",
         "defaultSeats"=EXCLUDED."defaultSeats",
         "defaultLuggage"=EXCLUDED."defaultLuggage",
         "isActive"=true,
         "sortOrder"=EXCLUDED."sortOrder",
         "updatedAt"=CURRENT_TIMESTAMP`,
      row,
    );
  }

  for (const item of vehicles) {
    const classRow = await client.query(`SELECT "id" FROM "VehicleClass" WHERE "slug"=(SELECT "slug" FROM "VehicleClass" WHERE "id"=$1 LIMIT 1)`, [item.classId]);
    const vehicleClassId = classRow.rows[0]?.id ?? item.classId;

    await client.query(
      `INSERT INTO "Vehicle"
        ("id","slug","registrationNumber","displayName","vehicleClassId","status","seats","luggage","airConditioned",
         "features","description","isFeatured","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'ACTIVE'::"VehicleStatus",$6,$7,true,$8::jsonb,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("slug") DO UPDATE SET
         "registrationNumber"=EXCLUDED."registrationNumber",
         "displayName"=EXCLUDED."displayName",
         "vehicleClassId"=EXCLUDED."vehicleClassId",
         "status"='ACTIVE'::"VehicleStatus",
         "seats"=EXCLUDED."seats",
         "luggage"=EXCLUDED."luggage",
         "airConditioned"=true,
         "features"=EXCLUDED."features",
         "description"=EXCLUDED."description",
         "isFeatured"=EXCLUDED."isFeatured",
         "updatedAt"=CURRENT_TIMESTAMP`,
      [item.id, item.slug, item.registration, item.name, vehicleClassId, item.seats, item.luggage, json(item.features), item.description, item.featured],
    );

    const vehicleRow = await client.query(`SELECT "id" FROM "Vehicle" WHERE "slug"=$1`, [item.slug]);
    await client.query(
      `INSERT INTO "VehicleMedia" ("vehicleId","mediaId","sortOrder","isPrimary")
       VALUES ($1,$2,0,true)
       ON CONFLICT ("vehicleId","mediaId") DO UPDATE SET "sortOrder"=0,"isPrimary"=true`,
      [vehicleRow.rows[0].id, item.mediaId],
    );
  }

  const pricing = [
    ["catalog-rate-mpv-oneway", "Premium MPV One Way", "catalog-class-mpv", "ONE_WAY", "PER_KM", 250000, 1800, 120, 50000, 35000, null, null, 50],
    ["catalog-rate-mpv-round", "Premium MPV Round Trip", "catalog-class-mpv", "ROUND_TRIP", "PER_KM", 300000, 1700, 250, 50000, 35000, null, null, 50],
    ["catalog-rate-muv-oneway", "Value MUV One Way", "catalog-class-muv", "ONE_WAY", "PER_KM", 200000, 1400, 120, 45000, 30000, null, null, 40],
    ["catalog-rate-muv-round", "Value MUV Round Trip", "catalog-class-muv", "ROUND_TRIP", "PER_KM", 250000, 1300, 250, 45000, 30000, null, null, 40],
    ["catalog-rate-suv-oneway", "Premium SUV One Way", "catalog-class-suv", "ONE_WAY", "PER_KM", 350000, 2400, 120, 65000, 45000, null, null, 30],
    ["catalog-rate-suv-round", "Premium SUV Round Trip", "catalog-class-suv", "ROUND_TRIP", "PER_KM", 400000, 2300, 250, 65000, 45000, null, null, 30],
    ["catalog-rate-indore-ujjain-mpv", "Indore to Ujjain Premium MPV", "catalog-class-mpv", "ONE_WAY", "FIXED", 180000, null, null, 0, 0, "indore", "ujjain", 200],
    ["catalog-rate-indore-omkareshwar-mpv", "Indore to Omkareshwar Premium MPV", "catalog-class-mpv", "ONE_WAY", "FIXED", 320000, null, null, 0, 0, "indore", "omkareshwar", 200],
    ["catalog-rate-bhopal-indore-mpv", "Bhopal to Indore Premium MPV", "catalog-class-mpv", "ONE_WAY", "FIXED", 520000, null, null, 0, 0, "bhopal", "indore", 200],
  ];

  for (const row of pricing) {
    await client.query(
      `INSERT INTO "PricingRule"
        ("id","name","vehicleClassId","tripType","basis","currency","baseAmountMinor","perKmMinor","minimumDistanceKm",
         "driverAllowancePerDayMinor","nightAllowanceMinor","originKey","destinationKey","priority","status","activeFrom","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4::"TripType",$5::"PricingBasis",'INR',$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE'::"PricingRuleStatus",$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET
         "name"=EXCLUDED."name",
         "vehicleClassId"=EXCLUDED."vehicleClassId",
         "tripType"=EXCLUDED."tripType",
         "basis"=EXCLUDED."basis",
         "currency"='INR',
         "baseAmountMinor"=EXCLUDED."baseAmountMinor",
         "perKmMinor"=EXCLUDED."perKmMinor",
         "minimumDistanceKm"=EXCLUDED."minimumDistanceKm",
         "driverAllowancePerDayMinor"=EXCLUDED."driverAllowancePerDayMinor",
         "nightAllowanceMinor"=EXCLUDED."nightAllowanceMinor",
         "originKey"=EXCLUDED."originKey",
         "destinationKey"=EXCLUDED."destinationKey",
         "priority"=EXCLUDED."priority",
         "status"='ACTIVE'::"PricingRuleStatus",
         "activeFrom"=EXCLUDED."activeFrom",
         "activeTo"=NULL,
         "updatedAt"=CURRENT_TIMESTAMP`,
      [...row, publishedAt],
    );
  }

  for (const pkg of packages) {
    await client.query(
      `INSERT INTO "TourPackage"
        ("id","slug","title","summary","body","status","durationDays","durationNights","heroMediaId","publishedAt",
         "seoTitle","seoDescription","robotsIndex","robotsFollow","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::jsonb,'PUBLISHED'::"ContentStatus",$6,$7,$8,$9,$10,$11,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("slug") DO UPDATE SET
         "title"=EXCLUDED."title",
         "summary"=EXCLUDED."summary",
         "body"=EXCLUDED."body",
         "status"='PUBLISHED'::"ContentStatus",
         "durationDays"=EXCLUDED."durationDays",
         "durationNights"=EXCLUDED."durationNights",
         "heroMediaId"=EXCLUDED."heroMediaId",
         "publishedAt"=EXCLUDED."publishedAt",
         "seoTitle"=EXCLUDED."seoTitle",
         "seoDescription"=EXCLUDED."seoDescription",
         "robotsIndex"=true,
         "robotsFollow"=true,
         "updatedAt"=CURRENT_TIMESTAMP`,
      [pkg.id, pkg.slug, pkg.title, pkg.summary, json(pkg.body), pkg.days, pkg.nights, pkg.mediaId, publishedAt, pkg.title, pkg.summary],
    );

    const packageRow = await client.query(`SELECT "id" FROM "TourPackage" WHERE "slug"=$1`, [pkg.slug]);
    const packageId = packageRow.rows[0].id;

    await client.query(`DELETE FROM "PackageDestination" WHERE "packageId"=$1`, [packageId]);
    for (let index = 0; index < pkg.destinations.length; index += 1) {
      const destinationSlug = destinations.find((item) => item.id === pkg.destinations[index])?.slug;
      const destinationRow = await client.query(`SELECT "id" FROM "Destination" WHERE "slug"=$1`, [destinationSlug]);
      await client.query(
        `INSERT INTO "PackageDestination" ("packageId","destinationId","sortOrder") VALUES ($1,$2,$3)
         ON CONFLICT ("packageId","destinationId") DO UPDATE SET "sortOrder"=EXCLUDED."sortOrder"`,
        [packageId, destinationRow.rows[0].id, index],
      );
    }

    await client.query(`DELETE FROM "PackageItineraryDay" WHERE "packageId"=$1`, [packageId]);
    for (let index = 0; index < pkg.itinerary.length; index += 1) {
      const [title, description] = pkg.itinerary[index];
      await client.query(
        `INSERT INTO "PackageItineraryDay" ("id","packageId","dayNumber","title","description","body")
         VALUES ($1,$2,$3,$4,$5,'[]'::jsonb)
         ON CONFLICT ("packageId","dayNumber") DO UPDATE SET
           "title"=EXCLUDED."title","description"=EXCLUDED."description","body"=EXCLUDED."body"`,
        [pkg.id + "-day-" + (index + 1), packageId, index + 1, title, description],
      );
    }

    await client.query(
      `INSERT INTO "PackagePriceOption"
        ("id","packageId","mode","currency","amountMinor","minTravellers","maxTravellers","isActive","sortOrder","createdAt","updatedAt")
       VALUES ($1,$2,'PER_PERSON'::"PackagePriceMode",'INR',$3,1,12,true,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET
         "packageId"=EXCLUDED."packageId",
         "mode"='PER_PERSON'::"PackagePriceMode",
         "currency"='INR',
         "amountMinor"=EXCLUDED."amountMinor",
         "minTravellers"=1,
         "maxTravellers"=12,
         "isActive"=true,
         "sortOrder"=0,
         "updatedAt"=CURRENT_TIMESTAMP`,
      [pkg.id + "-per-person", packageId, pkg.price],
    );

    const departureOffsets = [21, 45, 75];
    for (let index = 0; index < departureOffsets.length; index += 1) {
      const startsAt = addDays(departureOffsets[index], 1, 30);
      const endsAt = new Date(startsAt.getTime() + Math.max(0, pkg.days - 1) * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000);
      const salesCloseAt = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
      await client.query(
        `INSERT INTO "PackageDeparture"
          ("id","packageId","startsAt","endsAt","status","capacityTravellers","reservedTravellers","salesOpenAt","salesCloseAt","notes","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'OPEN'::"PackageDepartureStatus",12,0,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("id") DO NOTHING`,
        [pkg.id + "-departure-" + (index + 1), packageId, startsAt, endsAt, publishedAt, salesCloseAt, "Launch catalog scheduled departure"],
      );
    }
  }

  await client.query(
    `INSERT INTO "BlogCategory" ("id","slug","name","description","createdAt","updatedAt")
     VALUES
       ('catalog-blog-temple','temple-travel','Temple Travel','Temple and pilgrimage planning guides.',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ('catalog-blog-road','road-trips','Road Trips','Private road-trip planning guides across India.',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
       ('catalog-blog-heritage','heritage-travel','Heritage Travel','Heritage itineraries and destination planning guides.',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("slug") DO UPDATE SET
       "name"=EXCLUDED."name",
       "description"=EXCLUDED."description",
       "updatedAt"=CURRENT_TIMESTAMP`
  );

  for (const guide of seoGuides) {
    const categorySlug =
      guide.category === "Temple Travel"
        ? "temple-travel"
        : guide.category === "Heritage Travel"
          ? "heritage-travel"
          : "road-trips";
    const category = await client.query(
      `SELECT "id" FROM "BlogCategory" WHERE "slug"=$1`,
      [categorySlug],
    );

    await client.query(
      `INSERT INTO "BlogPost"
        ("id","slug","title","excerpt","body","status","categoryId","heroMediaId","publishedAt",
         "seoTitle","seoDescription","robotsIndex","robotsFollow","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::jsonb,'PUBLISHED'::"ContentStatus",$6,$7,$8,$9,$10,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("slug") DO UPDATE SET
         "title"=EXCLUDED."title",
         "excerpt"=EXCLUDED."excerpt",
         "body"=EXCLUDED."body",
         "status"='PUBLISHED'::"ContentStatus",
         "categoryId"=EXCLUDED."categoryId",
         "heroMediaId"=EXCLUDED."heroMediaId",
         "publishedAt"=EXCLUDED."publishedAt",
         "seoTitle"=EXCLUDED."seoTitle",
         "seoDescription"=EXCLUDED."seoDescription",
         "robotsIndex"=true,
         "robotsFollow"=true,
         "updatedAt"=CURRENT_TIMESTAMP`,
      [
        guide.id,
        guide.slug,
        guide.title,
        guide.excerpt,
        json(guide.body),
        category.rows[0].id,
        guide.mediaId,
        publishedAt,
        guide.seoTitle,
        guide.seoDescription,
      ],
    );
  }

  for (const page of legalPages) {
    await client.query(
      `INSERT INTO "CmsPage"
        ("id","slug","title","excerpt","body","status","publishedAt","seoTitle","seoDescription","robotsIndex","robotsFollow","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::jsonb,'PUBLISHED'::"ContentStatus",$6,$7,$8,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("slug") DO UPDATE SET
         "title"=EXCLUDED."title",
         "excerpt"=EXCLUDED."excerpt",
         "body"=EXCLUDED."body",
         "status"='PUBLISHED'::"ContentStatus",
         "publishedAt"=EXCLUDED."publishedAt",
         "seoTitle"=EXCLUDED."seoTitle",
         "seoDescription"=EXCLUDED."seoDescription",
         "robotsIndex"=true,
         "robotsFollow"=true,
         "updatedAt"=CURRENT_TIMESTAMP`,
      [page.id, page.slug, page.title, page.excerpt, json(page.body), publishedAt, page.seoTitle, page.seoDescription],
    );
  }

  for (const [id, scope, question, answer, sortOrder] of faqs) {
    await client.query(
      `INSERT INTO "Faq"
        ("id","scope","question","answer","sortOrder","status","publishedAt","createdAt","updatedAt")
       VALUES ($1,$2::"FaqScope",$3,$4,$5,'PUBLISHED'::"ContentStatus",$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("id") DO UPDATE SET
         "scope"=EXCLUDED."scope",
         "question"=EXCLUDED."question",
         "answer"=EXCLUDED."answer",
         "sortOrder"=EXCLUDED."sortOrder",
         "status"='PUBLISHED'::"ContentStatus",
         "publishedAt"=EXCLUDED."publishedAt",
         "updatedAt"=CURRENT_TIMESTAMP`,
      [id, scope, question, answer, sortOrder, publishedAt],
    );
  }

  await client.query(
    `INSERT INTO "Promotion"
      ("id","code","name","description","status","scope","discountKind","percentageBps","maxDiscountMinor",
       "minSubtotalMinor","maxRedemptions","redeemedCount","perCustomerLimit","activeFrom","activeTo","createdAt","updatedAt")
     VALUES
      ('catalog-promo-welcome','YATRA5','Launch Welcome Offer','5% off eligible launch bookings, capped at ₹1,000.',
       'ACTIVE'::"PromotionStatus",'ALL'::"PromotionScope",'PERCENTAGE'::"PromotionDiscountKind",500,100000,300000,500,0,1,$1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("code") DO UPDATE SET
       "name"=EXCLUDED."name",
       "description"=EXCLUDED."description",
       "status"='ACTIVE'::"PromotionStatus",
       "scope"='ALL'::"PromotionScope",
       "discountKind"='PERCENTAGE'::"PromotionDiscountKind",
       "percentageBps"=500,
       "fixedAmountMinor"=NULL,
       "currency"=NULL,
       "maxDiscountMinor"=100000,
       "minSubtotalMinor"=300000,
       "maxRedemptions"=500,
       "perCustomerLimit"=1,
       "activeFrom"=EXCLUDED."activeFrom",
       "activeTo"=EXCLUDED."activeTo",
       "updatedAt"=CURRENT_TIMESTAMP`,
    [publishedAt, addDays(120, 18, 29)],
  );

  await client.query("COMMIT");

  console.log("Launch catalog bootstrap complete.");
  console.log("Destinations:", destinations.length);
  console.log("Vehicles:", vehicles.length);
  console.log("Packages:", packages.length);
  console.log("FAQs:", faqs.length);
  console.log("Promotion: YATRA5");
  console.log("Note: catalog vehicle registration values are internal placeholders, not government registration claims.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
