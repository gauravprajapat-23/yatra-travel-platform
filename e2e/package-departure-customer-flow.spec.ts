import { test, expect } from "@playwright/test";

test("public package exposes only sellable departure and quote does not reserve inventory", async ({ page, request }) => {
  await page.goto("/packages/e2e-departure-package");

  await expect(
    page.getByRole("heading", { name: "E2E Departure Journey" }),
  ).toBeVisible();

  const departureSelect = page.getByLabel("Departure");
  await expect(departureSelect.locator("option")).toHaveCount(1);
  await expect(departureSelect.locator("option").first()).toContainText("3 seats left");

  const before = await request.post("/api/quotes/package", {
    data: {
      packageSlug: "e2e-departure-package",
      priceOptionId: "e2e_departure_price",
      departureId: "e2e_departure_open",
      travellers: 2,
      vehicleCount: null,
    },
  });

  expect(before.status()).toBe(201);
  const body = (await before.json()) as {
    quote: {
      subtotalMinor: string;
      totalMinor: string;
      departure: { remainingCapacity: number | null; startsAt: string };
    };
  };

  expect(body.quote.subtotalMinor).toBe("500000");
  expect(body.quote.totalMinor).toBe("500000");
  expect(body.quote.departure.remainingCapacity).toBe(3);

  const promotion = await request.post("/api/promotions/preview", {
    data: {
      quoteType: "PACKAGE",
      quoteId: body.quote.id,
      code: "E2EPACK",
      guestEmail: "package-promo@yatra.test",
    },
  });

  expect(promotion.status()).toBe(200);
  const promotionBody = (await promotion.json()) as {
    promotion: { code: string };
    quote: { discountMinor: string; totalMinor: string };
  };
  expect(promotionBody.promotion.code).toBe("E2EPACK");
  expect(promotionBody.quote.discountMinor).toBe("50000");
  expect(promotionBody.quote.totalMinor).toBe("450000");

  const second = await request.post("/api/quotes/package", {
    data: {
      packageSlug: "e2e-departure-package",
      priceOptionId: "e2e_departure_price",
      departureId: "e2e_departure_open",
      travellers: 2,
    },
  });

  expect(second.status()).toBe(201);
  const secondBody = (await second.json()) as {
    quote: { departure: { remainingCapacity: number | null } };
  };
  expect(secondBody.quote.departure.remainingCapacity).toBe(3);
});

test("public package rejects non-sellable departure quote", async ({ request }) => {
  for (const departureId of [
    "e2e_departure_closed",
    "e2e_departure_soldout",
  ]) {
    const response = await request.post("/api/quotes/package", {
      data: {
        packageSlug: "e2e-departure-package",
        priceOptionId: "e2e_departure_price",
        departureId,
        travellers: 1,
      },
    });

    expect(response.status()).toBe(409);
  }
});
