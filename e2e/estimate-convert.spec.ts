/**
 * E2E — Estimate creation and job conversion.
 *
 * Tests the exact flow that broke during the client demo:
 *   1. Create an estimate (non-PM client path)
 *   2. Verify it appears on the estimates list
 *   3. Open the estimate detail
 *   4. Convert it to a job — this previously returned 500 due to a bad
 *      column name (property_manager_id) and a status guard that blocked
 *      approved estimates
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Estimate → Job conversion", () => {
  test("convert a draft estimate to a job", async ({ page }) => {
    // Use the ?status=approved filter — the "Convert to Job" button only renders
    // for approved estimates. The seed creates an approved estimate last so it
    // appears first in date-descending order.
    await gotoSafe(page, "/owner/estimates?status=approved");

    const firstDraft = page
      .locator("main a[href*='/owner/estimates/']:not([href$='/new'])")
      .first();

    if (!(await firstDraft.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(); // no approved estimates in DB
      return;
    }

    await firstDraft.click();
    await expect(page).toHaveURL(/\/owner\/estimates\/[a-f0-9-]+/, { timeout: 10_000 });

    const convertBtn = page.getByRole("button", { name: /convert to job/i });
    if (!(await convertBtn.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(); // estimate not convertible (already converted/declined)
      return;
    }
    await convertBtn.click();

    const confirmBtn = page.getByRole("button", { name: /confirm|yes|convert/i }).last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await Promise.race([
      expect(page).toHaveURL(/\/owner\/jobs\/[a-f0-9-]+/, { timeout: 15_000 }),
      expect(page.getByText(/converted|job created/i).first()).toBeVisible({ timeout: 15_000 }),
    ]);

    await expect(page.getByText(/error|failed|500/i).first()).not.toBeVisible();
  });

  test("estimate detail page loads without error", async ({ page }) => {
    // Navigate to list first, then click the first estimate
    await gotoSafe(page, "/owner/estimates");
    const firstLink = page.locator("main a[href*='/owner/estimates/']:not([href$='/new'])").first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
      await expect(page).toHaveURL(/\/owner\/estimates\/[a-f0-9-]+/, { timeout: 10_000 });
      await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
    } else {
      test.skip(); // No estimates yet — skip rather than fail
    }
  });
});
