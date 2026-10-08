import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

test("mobile admin dispatch remains usable without page-level horizontal overflow", async ({ page }) => {
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for admin E2E.");
  }

  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page).toHaveURL(/\/admin(?:$|\?)/);

  for (const path of ["/admin/dispatch", "/admin/bookings", "/admin/reports"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(overflow, `${path} should not overflow the mobile viewport`).toBeFalsy();
  }

  await page.goto("/admin/dispatch/calendar");
  await expect(page.getByRole("heading", { name: /fleet availability calendar/i })).toBeVisible();

  const calendarScroller = page.locator('[class*="scroll"]').first();
  await expect(calendarScroller).toBeVisible();
  const scrollable = await calendarScroller.evaluate(
    (element) => element.scrollWidth >= element.clientWidth,
  );
  expect(scrollable).toBeTruthy();
});
