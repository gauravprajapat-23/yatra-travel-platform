import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

async function adminLogin(page: import("@playwright/test").Page) {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }

  await page.goto("/admin/login");
  await page.locator("#adminEmail").fill(adminEmail);
  await page.locator("#adminPassword").fill(adminPassword);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await expect(page).toHaveURL(/\/admin(?:$|\?)/);
}

test("public custom-trip enquiry appears in Admin Leads", async ({ request, page }) => {
  const unique = Date.now().toString();
  const travelDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const response = await request.post("/api/leads", {
    headers: {
      "Idempotency-Key": `e2e-lead-${unique}-123456`,
    },
    data: {
      type: "CUSTOM_TRIP",
      name: "E2E Funnel Traveller",
      email: `e2e-funnel-${unique}@yatra.test`,
      phone: "+919876543210",
      message: "Booking funnel visibility check",
      sourcePath: "/custom-trip",
      website: "",
      trip: {
        from: "Bhopal",
        to: "Ujjain",
        duration: 3,
        travelDate,
        travellers: 2,
        vehicle: "Innova Crysta · 6 Seats",
      },
    },
  });

  expect(response.status()).toBe(201);
  const body = (await response.json()) as { reference: string };
  expect(body.reference).toMatch(/^LD-/);

  await adminLogin(page);
  await page.goto(`/admin/leads?q=${encodeURIComponent(body.reference)}`);

  await expect(page.getByRole("link", { name: body.reference })).toBeVisible();
  await expect(page.getByText("E2E Funnel Traveller")).toBeVisible();
});

test("admin Bookings contains the seeded booking fixture", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/bookings?q=YAT-E2EASSIGN");
  await expect(page.getByRole("link", { name: "YAT-E2EASSIGN" }).first()).toBeVisible();
});
