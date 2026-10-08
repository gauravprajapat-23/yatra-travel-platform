import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";

const email = process.env.E2E_RESET_EMAIL ?? "phase10-reset@yatra.test";
const oldPassword = process.env.E2E_CUSTOMER_PASSWORD;
const newPassword = "Phase10-Reset-New-2026!";
const token = createHash("sha256")
  .update("phase10-password-reset-e2e")
  .digest("base64url");

test.describe.configure({ retries: 0 });

test("customer consumes one-time reset token, changes password, and cannot replay it", async ({ page }) => {
  if (!oldPassword) {
    throw new Error("E2E_CUSTOMER_PASSWORD is required.");
  }

  await page.goto(`/account/reset-password#token=${encodeURIComponent(token)}`);
  await page.locator("#customerNewPassword").fill(newPassword);
  await page.locator("#customerConfirmPassword").fill(newPassword);
  await page.getByRole("button", { name: "Reset Password" }).click();

  await expect(page.getByRole("heading", { name: "Password updated." })).toBeVisible();
  await expect(
    page.getByText("Your password has been reset. All previous account sessions were revoked for your security.", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign In" }).click();
  await page.locator("#customerEmail").fill(email);
  await page.locator("#customerPassword").fill(newPassword);

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
  await page.goto(`/account/reset-password#token=${encodeURIComponent(token)}`);
  await page.locator("#customerNewPassword").fill("Phase10-Replay-2026!");
  await page.locator("#customerConfirmPassword").fill("Phase10-Replay-2026!");
  await page.getByRole("button", { name: "Reset Password" }).click();

  await expect(
    page.getByText("This reset link is invalid or expired.", { exact: true }),
  ).toBeVisible();
});

test("password reset request stays disabled until provider delivery is certified", async ({ page }) => {
  await page.goto("/account/forgot-password");
  await page.locator("#customerResetEmail").fill(email);
  await page.getByRole("button", { name: "Send Reset Link" }).click();

  await expect(
    page.getByText("Password reset is not enabled yet.", { exact: true }),
  ).toBeVisible();
});
