import { test, expect } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const opsEmail = process.env.E2E_OPERATIONS_EMAIL;
const opsPassword = process.env.E2E_OPERATIONS_PASSWORD;

async function login(
  page: import("@playwright/test").Page,
  email: string | undefined,
  password: string | undefined,
) {
  if (!email || !password) throw new Error("Required admin credentials are missing.");

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
  expect(response.status()).toBe(200);
}

test("report reader can export operational CSV with new domains", async ({ page }) => {
  await login(page, adminEmail, adminPassword);

  const response = await page.request.get(
    "/api/admin/reports/export?from=2026-10-01&to=2026-10-31",
  );

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");

  const csv = await response.text();
  expect(csv).toContain('"CRM","Open follow-ups"');
  expect(csv).toContain('"Promotions","Redemptions"');
  expect(csv).toContain('"Departures","Reserved travellers"');
  expect(csv).toContain('"Fleet","Open maintenance"');
});

test("operations role cannot export management reports", async ({ page }) => {
  await login(page, opsEmail, opsPassword);

  const response = await page.request.get("/api/admin/reports/export");
  expect(response.status()).toBe(403);
});

test("report export rejects reversed IST date range", async ({ page }) => {
  await login(page, adminEmail, adminPassword);

  const response = await page.request.get(
    "/api/admin/reports/export?from=2026-10-31&to=2026-10-01",
  );

  expect(response.status()).toBe(400);
});
