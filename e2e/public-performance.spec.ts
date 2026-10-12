import { expect, test } from "@playwright/test";

for (const route of ["/", "/cars", "/packages", "/destinations"]) {
  test(`public page load stays within smoke budget: ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: "load" });

    const timing = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return entry
        ? {
            duration: entry.duration,
            domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
          }
        : { duration: 0, domContentLoaded: 0 };
    });

    expect(timing.domContentLoaded).toBeLessThan(8000);
    expect(timing.duration).toBeLessThan(10000);
  });
}
