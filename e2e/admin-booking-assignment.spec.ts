import { test, expect } from "@playwright/test";

const email = process.env.E2E_OPERATIONS_EMAIL;
const password = process.env.E2E_OPERATIONS_PASSWORD;
const reference = "YAT-E2EASSIGN";

test("operations admin assigns an available vehicle and driver", async ({ page }) => {
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

  await page.goto(`/admin/bookings/${reference}?tab=operations`);
  await expect(
    page.getByRole("heading", { name: "Vehicle & Driver Assignment" }),
  ).toBeVisible();

  await page.locator("#bookingVehicle").selectOption({
    label: /E2E Operations Vehicle/,
  });
  await page.locator("#bookingDriver").selectOption({
    label: /E2E Operations Driver/,
  });

  await page.getByRole("button", { name: "Assign Resources" }).click();
  await expect(
    page.getByText("Vehicle and driver assigned successfully."),
  ).toBeVisible();

  await page.goto(`/admin/bookings/${reference}`);
  await expect(page.getByText("DRIVER ASSIGNED")).toBeVisible();
  await expect(
    page.getByText("E2E Operations Driver · E2E Operations Vehicle"),
  ).toBeVisible();

  await page.goto(`/admin/bookings/${reference}?tab=timeline`);
  await expect(page.getByText("DRIVER ASSIGNED")).toBeVisible();
  await expect(
    page.getByText("Vehicle and driver assigned by operations."),
  ).toBeVisible();
});
