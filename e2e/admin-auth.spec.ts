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

  await page.getByRole("button", { name: /logout|sign out/i }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
