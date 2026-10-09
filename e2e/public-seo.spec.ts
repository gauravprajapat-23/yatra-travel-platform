import { test, expect } from "@playwright/test";

test("private workflow pages render noindex metadata", async ({ page }) => {
  for (const path of [
    "/admin/login",
    "/account/login",
    "/checkout",
    "/payment",
    "/my-trips",
  ]) {
    await page.goto(path);
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute("content", /noindex/i);
  }
});

test("sitemap excludes private workflows and robots disallows them", async ({
  request,
}) => {
  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();

  for (const forbidden of [
    "/admin/",
    "/account/",
    "/booking/",
    "/checkout",
    "/payment",
    "/my-trips",
    "/custom-trip",
    "/cars/search",
  ]) {
    expect(sitemap).not.toContain(forbidden);
  }

  const robotsResponse = await request.get("/robots.txt");
  expect(robotsResponse.status()).toBe(200);
  const robots = await robotsResponse.text();

  for (const disallowed of [
    "/admin/",
    "/api/",
    "/booking/",
    "/checkout",
    "/payment",
    "/my-trips",
    "/custom-trip",
    "/cars/search",
  ]) {
    expect(robots).toContain(`Disallow: ${disallowed}`);
  }
});

test("unknown public URL uses branded 404 recovery", async ({ page }) => {
  const response = await page.goto("/this-route-should-never-exist-e2e");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This journey does not exist." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Packages" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Cars" })).toBeVisible();
});
