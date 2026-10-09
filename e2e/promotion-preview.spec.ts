import { test, expect } from "@playwright/test";

test("promotion preview derives discount from stored quote", async ({ request }) => {
  const response = await request.post("/api/promotions/preview", {
    data: {
      quoteType: "CAR",
      quoteId: "e2e_promotion_quote",
      code: "e2e10",
      guestEmail: "promo-preview@yatra.test",
    },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    promotion: { code: string; name: string };
    quote: {
      currency: string;
      subtotalMinor: string;
      discountMinor: string;
      taxMinor: string;
      totalMinor: string;
    };
  };

  expect(body.promotion.code).toBe("E2E10");
  expect(body.quote.currency).toBe("INR");
  expect(body.quote.subtotalMinor).toBe("100000");
  expect(body.quote.discountMinor).toBe("10000");
  expect(body.quote.taxMinor).toBe("0");
  expect(body.quote.totalMinor).toBe("90000");
});

test("promotion preview rejects unknown code", async ({ request }) => {
  const response = await request.post("/api/promotions/preview", {
    data: {
      quoteType: "CAR",
      quoteId: "e2e_promotion_quote",
      code: "NOPE10",
      guestEmail: "promo-preview@yatra.test",
    },
  });

  expect(response.status()).toBe(404);
  const body = (await response.json()) as {
    error?: { code?: string };
  };
  expect(body.error?.code).toBe("PROMOTION_NOT_FOUND");
});
