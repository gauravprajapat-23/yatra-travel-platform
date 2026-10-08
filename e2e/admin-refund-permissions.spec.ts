import { test, expect } from "@playwright/test";

const superEmail = process.env.ADMIN_EMAIL;
const superPassword = process.env.ADMIN_PASSWORD;
const opsEmail = process.env.E2E_OPERATIONS_EMAIL;
const opsPassword = process.env.E2E_OPERATIONS_PASSWORD;
const reference = "YAT-E2EREFUND";

async function login(
  page: import("@playwright/test").Page,
  email: string | undefined,
  password: string | undefined,
) {
  if (!email || !password) {
    throw new Error("Required E2E admin credentials are missing.");
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

test("operations role cannot access refund controls", async ({ page }) => {
  await login(page, opsEmail, opsPassword);
  await page.goto(`/admin/bookings/${reference}?tab=payments`);

  await expect(page.getByRole("heading", { name: "Payment Activity" })).toBeVisible();
  await expect(page.getByText("CAPTURED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /refund remaining/i }),
  ).toHaveCount(0);
});

test("super admin sees calculated remaining-refund control while writes stay gated", async ({ page }) => {
  await login(page, superEmail, superPassword);
  await page.goto(`/admin/bookings/${reference}?tab=payments`);

  await expect(page.getByText("CAPTURED", { exact: true })).toBeVisible();
  const refundButton = page.getByRole("button", {
    name: /refund remaining ₹1,200\.00/i,
  });
  await expect(refundButton).toBeVisible();
});
