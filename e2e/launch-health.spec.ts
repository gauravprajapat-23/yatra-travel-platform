import { test, expect } from "@playwright/test";

test("launch health exposes non-secret modern readiness contract", async ({ request }) => {
  const response = await request.get("/api/health/launch");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = (await response.json()) as Record<string, unknown>;

  for (const key of [
    "databaseConfigured",
    "databaseReachable",
    "customerAuthWriteEnabled",
    "customerPasswordResetEnabled",
    "notificationEmailProviderConfigured",
    "promotionApplyEnabled",
    "activePromotions",
    "openPackageDepartures",
    "fleetComplianceBlockers",
    "customerAuthReady",
    "passwordResetReady",
    "promotionReady",
    "packageDepartureReady",
    "fleetComplianceReady",
    "crmReady",
  ]) {
    expect(body).toHaveProperty(key);
  }

  expect(body.databaseConfigured).toBe(true);
  expect(body.databaseReachable).toBe(true);
  expect(body.customerAuthWriteEnabled).toBe(false);
  expect(body.customerPasswordResetEnabled).toBe(false);
  expect(body.promotionApplyEnabled).toBe(true);
  expect(body.crmReady).toBe(true);

  const serialized = JSON.stringify(body);
  for (const forbidden of [
    process.env.ADMIN_PASSWORD,
    process.env.E2E_CUSTOMER_PASSWORD,
    process.env.DATABASE_URL,
  ]) {
    if (forbidden) {
      expect(serialized).not.toContain(forbidden);
    }
  }

  expect(serialized).not.toContain("RAZORPAY_KEY_SECRET");
  expect(serialized).not.toContain("RAZORPAY_WEBHOOK_SECRET");
  expect(serialized).not.toContain("RESEND_API_KEY");
  expect(serialized).not.toContain("FIELD_ENCRYPTION_KEY");
  expect(serialized).not.toContain("AUTH_SECRET");
});
