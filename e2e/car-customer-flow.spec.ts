import { test, expect } from "@playwright/test";

test("public car quote derives fixed route pricing from server configuration", async ({ request }) => {
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const response = await request.post("/api/quotes/car", {
    data: {
      origin: "Bhopal",
      destination: "Indore",
      startsAt,
      travellers: 2,
      tripType: "ONE_WAY",
      vehicleSlug: "e2e-assignment-vehicle",
    },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as {
    quote: {
      vehicle: { slug: string; seats: number };
      currency: string;
      subtotalMinor: string;
      discountMinor: string;
      totalMinor: string;
    };
  };

  expect(body.quote.vehicle.slug).toBe("e2e-assignment-vehicle");
  expect(body.quote.vehicle.seats).toBe(6);
  expect(body.quote.currency).toBe("INR");
  expect(body.quote.subtotalMinor).toBe("135000");
  expect(body.quote.discountMinor).toBe("0");
  expect(body.quote.totalMinor).toBe("135000");
});

test("public car quote rejects traveller count above vehicle capacity", async ({ request }) => {
  const response = await request.post("/api/quotes/car", {
    data: {
      origin: "Bhopal",
      destination: "Indore",
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      travellers: 7,
      tripType: "ONE_WAY",
      vehicleSlug: "e2e-assignment-vehicle",
    },
  });

  expect(response.status()).toBe(409);
  const body = (await response.json()) as {
    error?: { code?: string };
  };
  expect(body.error?.code).toBe("VEHICLE_CAPACITY_EXCEEDED");
});


test("vehicle detail preserves the selected vehicle when starting booking", async ({ page }) => {
  await page.goto("/cars/e2e-assignment-vehicle");

  const bookingLink = page.getByRole("link", { name: "Book This Car" });
  await expect(bookingLink).toHaveAttribute(
    "href",
    "/?vehicle=e2e-assignment-vehicle#car-search",
  );
});

test("public car quote rejects a departure date in the past", async ({ request }) => {
  const response = await request.post("/api/quotes/car", {
    data: {
      origin: "Bhopal",
      destination: "Indore",
      startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      travellers: 2,
      tripType: "ONE_WAY",
      vehicleSlug: "e2e-assignment-vehicle",
    },
  });

  expect(response.status()).toBe(400);
  const body = (await response.json()) as {
    error?: { code?: string };
  };
  expect(body.error?.code).toBe("PAST_DEPARTURE_DATE");
});


test("car search links every published vehicle to its dynamic detail page", async ({ page }) => {
  const departure = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  await page.goto(
    `/cars/search?from=Bhopal&to=Indore&departure=${departure}&travellers=2&tripType=ONE_WAY`,
  );

  const card = page
    .locator(".search-result-card")
    .filter({ hasText: "E2E Customer Car" })
    .first();

  await expect(card.getByRole("link", { name: "View Details" })).toHaveAttribute(
    "href",
    "/cars/e2e-assignment-vehicle",
  );
});


test("selected vehicle survives trip search from vehicle detail", async ({ page }) => {
  await page.goto("/cars/e2e-assignment-vehicle");
  await page.getByRole("link", { name: "Book This Car" }).click();

  await expect(page).toHaveURL(/vehicle=e2e-assignment-vehicle/);
  await page.getByLabel("From city").fill("Bhopal");
  await page.getByLabel("Destination city").fill("Indore");

  const departure = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await page.getByLabel("Departure date").fill(departure);
  await page.getByLabel("Return date").fill("");

  await page.getByRole("button", { name: "Continue With This Car" }).click();

  await expect(page).toHaveURL(/\/booking\/car\?/);
  expect(new URL(page.url()).searchParams.get("vehicle")).toBe(
    "e2e-assignment-vehicle",
  );
  expect(new URL(page.url()).searchParams.get("from")).toBe("Bhopal");
  expect(new URL(page.url()).searchParams.get("to")).toBe("Indore");
});
