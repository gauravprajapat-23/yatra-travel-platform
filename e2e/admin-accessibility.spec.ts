import { test, expect } from "@playwright/test";

test("admin login supports keyboard skip navigation and labeled credentials", async ({ page }) => {
  await page.goto("/admin/login");

  const skipLink = page.locator('a[href="#main-content"]');
  await expect(skipLink).toBeAttached();

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /show password/i })).toBeVisible();
});
