import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test("notification monitor masks destinations and exposes delivery outcomes", async ({ page }) => {
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

  if (loginResponse.status() !== 200) {
    throw new Error(
      `Admin login failed with HTTP ${loginResponse.status()}: ${await loginResponse.text()}`,
    );
  }

  await page.goto("/admin/notifications");

  await expect(
    page.getByRole("heading", { name: "Notification Deliveries" }),
  ).toBeVisible();

  await expect(page.getByText("phase10-monitor@yatra.test")).toHaveCount(0);
  await expect(page.getByText(/p\*+@yatra\.test/).first()).toBeVisible();

  const table = page.locator("table");
  await expect(table.getByText("SENT", { exact: true })).toBeVisible();
  await expect(table.getByText("FAILED", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/E2E provider timeout for monitoring certification/),
  ).toBeVisible();

  await expect(page.getByText("msg_e2e_sent", { exact: true })).toBeVisible();
});
