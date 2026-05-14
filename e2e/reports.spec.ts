/**
 * E2E — Reports smoke tests.
 *
 * Verifies every report page loads without a 500 / error boundary.
 * Also checks that key UI elements (chart or table) are present.
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

const REPORT_PAGES = [
  { url: "/owner/reports/revenue",            label: "Revenue report" },
  { url: "/owner/reports/estimate-conversion", label: "Estimate conversion report" },
  { url: "/owner/reports/jobs-to-invoice",    label: "Jobs to invoice report" },
  { url: "/owner/reports/recurring-health",   label: "Recurring health report" },
];

test.describe("Reports — smoke tests", () => {
  for (const { url, label } of REPORT_PAGES) {
    test(`${label} loads without error`, async ({ page }) => {
      await gotoSafe(page, url);
      await expect(
        page.getByRole("heading", { name: /error|500|something went wrong/i })
      ).not.toBeVisible();
    });
  }

  test("/owner/reports redirects to revenue report", async ({ page }) => {
    await page.goto("/owner/reports");
    await expect(page).toHaveURL(/\/owner\/reports\/revenue/, { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /error|500/i })
    ).not.toBeVisible();
  });

  test("revenue report shows a date range or chart element", async ({ page }) => {
    await gotoSafe(page, "/owner/reports/revenue");
    // Either a chart wrapper, a table, or the "no data" empty state should be visible
    const content = page
      .locator("canvas, table, [data-testid='chart'], [role='img']")
      .first()
      .or(page.getByText(/no revenue|no data|no jobs/i).first());

    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("estimate conversion report renders without empty-state error", async ({ page }) => {
    await gotoSafe(page, "/owner/reports/estimate-conversion");
    // Page should contain some heading or stat card
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 8_000 });
  });

  test("jobs-to-invoice report renders without error", async ({ page }) => {
    await gotoSafe(page, "/owner/reports/jobs-to-invoice");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 8_000 });
  });
});
