import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test("admin can find and inspect a discounted promotion booking", async ({ page }) => {
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  await page.goto("/admin/login");
  await page.locator("#adminEmail").fill(email);
  await page.locator("#adminPassword").fill(password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin-auth/login") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);

  expect(loginResponse.status()).toBe(200);

  await page.goto("/admin/bookings?q=E2E10");
  const bookingLink = page.locator('a[href^="/admin/bookings/YAT-"]').first();
  await expect(bookingLink).toBeVisible();
  await bookingLink.click();

  await expect(page.getByText("E2E10 · E2E Ten Percent")).toBeVisible();

  await page.getByRole("link", { name: /payments/i }).click();
  await expect(page.getByText("Promotion discount", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E10", { exact: true }).first()).toBeVisible();

  await page.goto("/admin/reports");
  await expect(page.getByText("Promotion Savings", { exact: true })).toBeVisible();
  await expect(page.getByText("E2E10 · E2E Ten Percent")).toBeVisible();
});
