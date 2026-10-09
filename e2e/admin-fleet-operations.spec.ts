import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const vehicleId = "e2e_assignment_maintenance_vehicle";

test("admin manages fleet maintenance and compliance tabs", async ({ page }) => {
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

  await page.goto(`/admin/vehicles/${vehicleId}?tab=maintenance`);
  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Schedule Maintenance" }),
  ).toBeVisible();
  await expect(page.getByText("Periodic service", { exact: true })).toBeVisible();
  await expect(page.getByText("Inspection", { exact: true })).toBeVisible();

  await page.goto(`/admin/vehicles/${vehicleId}?tab=compliance`);
  await expect(
    page.getByRole("heading", { name: "Vehicle Compliance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add Compliance Document" }),
  ).toBeVisible();

  await page.locator("#complianceType").selectOption("INSURANCE");
  await page.locator("#complianceLabel").fill("E2E Browser Insurance");
  await page.locator("#complianceReference").fill("6666");

  const issued = new Date();
  issued.setDate(issued.getDate() - 10);
  const expires = new Date();
  expires.setDate(expires.getDate() + 45);

  await page.locator("#complianceIssued").fill(issued.toISOString().slice(0, 10));
  await page.locator("#complianceExpiry").fill(expires.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add Compliance Document" }).click();

  const row = page.locator("tr", { hasText: "E2E Browser Insurance" }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText("INSURANCE", { exact: true })).toBeVisible();
  await expect(row.getByText("Blocks when expired", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(
    page.locator("tr", { hasText: "E2E Browser Insurance" }),
  ).toHaveCount(0);
});
