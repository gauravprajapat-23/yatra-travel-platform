import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test.beforeEach(() => {
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for admin E2E.");
  }
});

test("unauthenticated admin route redirects to login", async ({ page }) => {
  await page.goto("/admin/dispatch");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("admin can login, navigate protected operations, and logout", async ({ page }) => {
  await page.goto("/admin/login");

  await page.locator("#adminEmail").fill(email!);
  await page.locator("#adminPassword").fill(password!);
  await page.getByRole("button", { name: /sign in|login/i }).click();

  await expect(page).toHaveURL(/\/admin(?:$|\?)/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/admin/dispatch");
  await expect(page.getByRole("heading", { name: /dispatch/i })).toBeVisible();

  await page.goto("/admin/dispatch/calendar");
  await expect(page.getByRole("heading", { name: /fleet availability calendar/i })).toBeVisible();

  const logout = page.getByRole("button", { name: /logout|sign out/i });
  if (await logout.count()) {
    await logout.first().click();
  } else {
    await page.request.post("/api/admin-auth/logout", {
      headers: { origin: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000" },
    });
    await page.context().clearCookies();
    await page.goto("/admin");
  }

  await expect(page).toHaveURL(/\/admin\/login/);
});
