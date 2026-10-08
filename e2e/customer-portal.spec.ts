import { test, expect } from "@playwright/test";

const email = process.env.E2E_CUSTOMER_EMAIL;
const password = process.env.E2E_CUSTOMER_PASSWORD;
const reference = "YAT-E2ECUST";

test("verified customer signs in, sees only linked booking, and signs out", async ({ page }) => {
  if (!email || !password) {
    throw new Error("E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD are required.");
  }

  await page.goto("/account/login");
  await page.locator("#customerEmail").fill(email);
  await page.locator("#customerPassword").fill(password);

  const [response] = await Promise.all([
    page.waitForResponse(
      (item) =>
        item.url().endsWith("/api/customer-auth/login") &&
        item.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Sign In" }).click(),
  ]);

  if (response.status() !== 200) {
    throw new Error(
      `Customer login failed with HTTP ${response.status()}: ${await response.text()}`,
    );
  }

  await expect(page).toHaveURL(/\/my-trips/);
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  await expect(page.getByText("Bhopal → Indore", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E Customer Car", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/account\/login/);

  await page.goto("/my-trips");
  await expect(page.getByRole("link", { name: "Customer Sign In" })).toBeVisible();
});

test("public customer registration stays disabled until verification delivery is certified", async ({ request }) => {
  const response = await request.post("/api/customer-auth/register", {
    headers: {
      origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    },
    data: {
      name: "Unverified Customer",
      email: "unverified-e2e@yatra.test",
      password: "Phase9-Unverified-2026!",
    },
  });

  expect(response.status()).toBe(503);
  const body = await response.json();
  expect(body.error?.code).toBe("REGISTRATION_DISABLED");
});
