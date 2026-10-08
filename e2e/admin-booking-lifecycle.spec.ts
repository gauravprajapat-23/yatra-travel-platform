import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const reference = "YAT-E2ELIFE";

test.describe.configure({ retries: 0 });

async function login(page: import("@playwright/test").Page) {
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  await page.goto("/admin/login");
  await page.locator("#adminEmail").fill(email);
  await page.locator("#adminPassword").fill(password);

  const [response] = await Promise.all([
    page.waitForResponse(
      (item) =>
        item.url().endsWith("/api/admin-auth/login") &&
        item.request().method() === "POST",
    ),
    page.getByRole("button", { name: /sign in/i }).click(),
  ]);

  if (response.status() !== 200) {
    throw new Error(
      `Admin login failed with HTTP ${response.status()}: ${await response.text()}`,
    );
  }
}

test("super admin advances and cancels a zero-value booking through validated lifecycle", async ({ page }) => {
  await login(page);

  await page.goto(`/admin/bookings/${reference}?tab=operations`);
  await expect(page.getByRole("heading", { name: "Change Status" })).toBeVisible();

  const status = page.locator("#bookingNextStatus");
  await expect(status.locator('option[value="CONFIRMED"]')).toHaveCount(1);
  await status.selectOption("CONFIRMED");
  await page.locator("#bookingStatusReason").fill("E2E confirmed by admin.");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/admin/bookings/${reference}`),
    ),
    page.getByRole("button", { name: "Update Status" }).click(),
  ]);

  await page.goto(`/admin/bookings/${reference}?tab=operations`);
  await expect(page.locator("#bookingNextStatus")).toContainText("CANCELLED");
  await page.locator("#bookingNextStatus").selectOption("CANCELLED");
  await page.locator("#bookingStatusReason").fill("E2E cancellation validation.");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/admin/bookings/${reference}`),
    ),
    page.getByRole("button", { name: "Update Status" }).click(),
  ]);

  await page.goto(`/admin/bookings/${reference}?tab=timeline`);
  const timeline = page
    .getByRole("heading", { name: "Operational Timeline" })
    .locator("..");

  await expect(timeline.getByText("CONFIRMED", { exact: true })).toBeVisible();
  await expect(timeline.getByText("E2E confirmed by admin.", { exact: true })).toBeVisible();
  await expect(timeline.getByText("CANCELLED", { exact: true })).toBeVisible();
  await expect(timeline.getByText("E2E cancellation validation.", { exact: true })).toBeVisible();
});
