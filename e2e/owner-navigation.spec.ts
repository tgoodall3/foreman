/**
 * E2E — Owner navigation smoke tests.
 *
 * Verifies every main owner page loads without a 500 error.
 * This class of test would have caught the estimate-to-job 500 if the
 * convert button was tested, and the invoice send 400 on the send flow.
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Owner — page smoke tests", () => {
  const pages = [
    "/owner",
    "/owner/jobs",
    "/owner/invoices",
    "/owner/estimates",
    "/owner/properties",
    "/owner/work-orders",
    "/owner/workers",
    "/owner/timesheets",
    "/owner/schedule",
    "/owner/settings",
    "/owner/settings/billing",
  ];

  for (const url of pages) {
    test(`${url} loads without error`, async ({ page }) => {
      await gotoSafe(page, url);
      // No visible error heading
      await expect(page.getByRole("heading", { name: /error|500|something went wrong/i })).not.toBeVisible();
    });
  }
});
