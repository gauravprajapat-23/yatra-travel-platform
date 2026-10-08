import { test, expect } from "@playwright/test";

const email = process.env.E2E_OPERATIONS_EMAIL;
const password = process.env.E2E_OPERATIONS_PASSWORD;

test("operations admin sees only allowed navigation and is denied restricted routes", async ({ page }) => {
  if (!email || !password) {
    throw new Error("E2E_OPERATIONS_EMAIL and E2E_OPERATIONS_PASSWORD are required.");
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
      `Operations login failed with HTTP ${loginResponse.status()}: ${await loginResponse.text()}`,
    );
  }

  await expect(page).toHaveURL(/\/admin(?:$|\?)/);

  const sidebar = page.locator(".admin-sidebar nav");

  for (const href of [
    "/admin/bookings",
    "/admin/dispatch",
    "/admin/vehicles",
    "/admin/drivers",
  ]) {
    await expect(sidebar.locator(`a[href="${href}"]`)).toBeVisible();
  }

  for (const href of [
    "/admin/payments",
    "/admin/notifications",
    "/admin/staff",
    "/admin/reports",
    "/admin/audit",
    "/admin/settings",
    "/admin/cms",
  ]) {
    await expect(sidebar.locator(`a[href="${href}"]`)).toHaveCount(0);
  }

  for (const path of [
    "/admin/staff",
    "/admin/settings",
    "/admin/payments",
    "/admin/notifications",
    "/admin/reports",
    "/admin/audit",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin(?:$|\?)/);
  }

  await page.goto("/admin/dispatch");
  await expect(page.getByRole("heading", { name: /dispatch/i })).toBeVisible();
});
