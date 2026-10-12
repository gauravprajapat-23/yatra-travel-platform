import { expect, test } from "@playwright/test";

test("custom trip request never enters payment checkout without a priced booking", async ({ page }) => {
  await page.goto("/custom-trip");

  await page.getByLabel("Full Name").fill("Custom Trip Traveller");
  await page.getByLabel("Email").fill("custom-trip-flow@yatra.test");
  await page.getByLabel("Mobile Number").fill("+919876543210");
  await page.getByLabel("From").fill("Bhopal");
  await page.getByLabel("To").fill("Ujjain");

  const date = new Date();
  date.setDate(date.getDate() + 14);
  const travelDate = date.toISOString().slice(0, 10);
  await page.getByLabel("Travel Date").fill(travelDate);

  await page.getByLabel("No. of Travellers").fill("5");
  await page.getByLabel("Special Requests").fill("Senior traveller assistance");

  await page.getByRole("button", { name: /Create My Trip/i }).click();

  await expect(page).toHaveURL(/\/custom-trip\/success\?reference=LD-/);
  await expect(page.getByRole("heading", { name: /Your custom trip request is with the YATRA team/i })).toBeVisible();
  await expect(page.getByText("No payment is required now")).toBeVisible();
  await expect(page.getByText("Price confirmation required")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/checkout/);
});
