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
    "/booking/car?vehicle=e2e-assignment-vehicle",
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
