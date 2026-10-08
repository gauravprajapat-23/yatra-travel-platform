import { test, expect } from "@playwright/test";

const email = process.env.E2E_VERIFY_EMAIL;
const password = process.env.E2E_VERIFY_PASSWORD;
const token = process.env.E2E_VERIFY_TOKEN;

test.describe.configure({ retries: 0 });

test("unverified customer consumes one-time email token, signs in, and cannot replay it", async ({ page }) => {
  if (!email || !password || !token) {
    throw new Error("E2E_VERIFY_EMAIL, E2E_VERIFY_PASSWORD and E2E_VERIFY_TOKEN are required.");
  }

  await page.goto(`/account/verify-email?token=${encodeURIComponent(token)}`);

  await expect(page).toHaveURL(/\/account\/verify-email$/);
  await expect(
    page.getByRole("heading", { name: "Email verified." }),
  ).toBeVisible();
  await expect(
    page.getByText("Email verified. You can now sign in.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign In" }).click();
  await page.locator("#customerEmail").fill(email);
  await page.locator("#customerPassword").fill(password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/customer-auth/login") &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Sign In" }).click(),
  ]);

  expect(loginResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/my-trips/);

  await page.context().clearCookies();
  await page.goto(`/account/verify-email?token=${encodeURIComponent(token)}`);
  await expect(page).toHaveURL(/\/account\/verify-email$/);
  await expect(
    page.getByRole("heading", { name: "Verification failed." }),
  ).toBeVisible();
  await expect(
    page.getByText("This verification link is invalid or has expired.", {
      exact: true,
    }),
  ).toBeVisible();
});
