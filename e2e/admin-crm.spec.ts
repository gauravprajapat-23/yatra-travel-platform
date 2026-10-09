import { test, expect } from "@playwright/test";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const reference = "LEAD-E2ECRM";

test.describe.configure({ retries: 0 });

async function waitForLeadServerAction(
  page: import("@playwright/test").Page,
  action: () => Promise<unknown>,
) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (item) =>
        item.request().method() === "POST" &&
        item.url().includes(`/admin/leads/${reference}`),
    ),
    action(),
  ]);

  expect(response.status()).toBeLessThan(400);
}

test("admin logs CRM interaction, schedules follow-up, sees queue, and completes it", async ({ page }) => {
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

  await page.goto(`/admin/leads/${reference}?tab=crm`);
  await expect(page.getByRole("heading", { name: "Interaction History" })).toBeVisible();

  await page.locator("#crmSubject").fill("E2E CRM note");
  await page.locator("#crmBody").fill("Customer asked for a callback about temple package options.");
  await waitForLeadServerAction(page, () =>
    page.getByRole("button", { name: "Add Interaction" }).click(),
  );

  await page.goto(`/admin/leads/${reference}?tab=crm`);
  await expect(page.getByText("E2E CRM note", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Customer asked for a callback about temple package options.", {
      exact: true,
    }),
  ).toBeVisible();

  await page.locator("#crmFollowUpTitle").fill("Call customer");
  await page.locator("#crmFollowUpDueAt").fill("2026-10-10T15:00");
  await page.locator("#crmFollowUpNotes").fill("Discuss package options and dates.");
  await waitForLeadServerAction(page, () =>
    page.getByRole("button", { name: "Create Follow-up" }).click(),
  );

  await page.goto("/admin/crm");
  await expect(page.getByText("Call customer", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /E2E CRM Traveller/ }).first(),
  ).toBeVisible();

  await page.goto(`/admin/leads/${reference}?tab=crm`);
  await waitForLeadServerAction(page, () =>
    page.getByRole("button", { name: "Complete" }).click(),
  );

  await page.goto("/admin/crm");
  await expect(page.getByText("Call customer", { exact: true })).toHaveCount(0);
});

test("operations role cannot modify CRM", async ({ page }) => {
  const opsEmail = process.env.E2E_OPERATIONS_EMAIL;
  const opsPassword = process.env.E2E_OPERATIONS_PASSWORD;
  if (!opsEmail || !opsPassword) throw new Error("Operations credentials are required.");

  await page.goto("/admin/login");
  await page.locator("#adminEmail").fill(opsEmail);
  await page.locator("#adminPassword").fill(opsPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(?:$|\?)/);

  await page.goto("/admin/crm");
  await expect(page.getByRole("heading", { name: "CRM Follow-ups" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Assign" })).toHaveCount(0);

  await page.goto(`/admin/leads/${reference}?tab=crm`);
  await expect(page).toHaveURL(/\/admin(?:$|\?)/);
});
