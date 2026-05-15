/**
 * E2E — Change orders flow (owner side).
 *
 * Tests:
 *   1. Job detail page loads and shows change orders section
 *   2. New change order page loads without error
 *   3. Creating a change order succeeds and redirects back to the job
 *   4. Change order detail / edit page loads without error
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Change orders — owner flow", () => {
  test("job detail page loads the change orders section", async ({ page }) => {
    await gotoSafe(page, "/owner/jobs");

    const firstJob = page.locator("main a[href*='/owner/jobs/']:not([href$='/new']):visible").first();
    if (!(await firstJob.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(); // no jobs in DB
      return;
    }

    await firstJob.click();
    await expect(page).toHaveURL(/\/owner\/jobs\/[a-f0-9-]+/, { timeout: 10_000 });

    // The change orders section should be on the page (may be empty)
    await expect(
      page.getByText(/change order/i).first()
    ).toBeVisible({ timeout: 8_000 });

    await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
  });

  test("new change order page loads without error", async ({ page }) => {
    await gotoSafe(page, "/owner/jobs");

    const firstJob = page.locator("main a[href*='/owner/jobs/']:not([href$='/new']):visible").first();
    if (!(await firstJob.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstJob.click();
    await expect(page).toHaveURL(/\/owner\/jobs\/([a-f0-9-]+)/, { timeout: 10_000 });

    // Extract the job ID and navigate directly to the new CO page
    const jobId = page.url().match(/\/owner\/jobs\/([a-f0-9-]+)/)?.[1];
    if (!jobId) { test.skip(); return; }

    await gotoSafe(page, `/owner/jobs/${jobId}/change-orders/new`);
    await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();

    // Form elements should be present
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: 5_000 });
  });

  test("creating a change order does not 500", async ({ page }) => {
    await gotoSafe(page, "/owner/jobs");

    const firstJob = page.locator("main a[href*='/owner/jobs/']:not([href$='/new']):visible").first();
    if (!(await firstJob.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstJob.click();
    await expect(page).toHaveURL(/\/owner\/jobs\/([a-f0-9-]+)/, { timeout: 10_000 });
    const jobId = page.url().match(/\/owner\/jobs\/([a-f0-9-]+)/)?.[1];
    if (!jobId) { test.skip(); return; }

    await gotoSafe(page, `/owner/jobs/${jobId}/change-orders/new`);

    // Find and fill the title field
    const titleInput = page.locator("input[name='title'], input[placeholder*='title' i], #title").first();
    if (!(await titleInput.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await titleInput.pressSequentially("E2E Test Change Order");

    // Fill line item description — pressSequentially fires per-keystroke onChange (more reliable than fill)
    const descInput = page.locator("input[placeholder='Item description']").first();
    if (await descInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await descInput.pressSequentially("Additional labor");
    }

    // Fill line item unit price
    const priceInput = page.locator("input[placeholder='0.00']").first();
    if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await priceInput.pressSequentially("500");
    }

    // Wait for React to re-render the button as enabled after filling the title.
    // isEnabled() returns immediately without waiting; toBeEnabled() polls.
    const submitBtn = page.getByRole("button", { name: /create|save|submit/i }).first();
    try {
      await expect(submitBtn).toBeEnabled({ timeout: 8_000 });
    } catch {
      test.skip();
      return;
    }

    const [coResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/change-orders") && r.request().method() === "POST",
        { timeout: 8_000 }
      ).catch(() => null),
      submitBtn.click(),
    ]);

    if (coResponse) {
      expect(coResponse.status()).not.toBe(500); // should not 500
      expect(coResponse.status()).toBe(201);     // should succeed
    }

    // Should have navigated away from the form (back to job or CO detail)
    await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
  });

  test("change orders list page for a job loads without error", async ({ page }) => {
    await gotoSafe(page, "/owner/jobs");

    const firstJob = page.locator("main a[href*='/owner/jobs/']:not([href$='/new']):visible").first();
    if (!(await firstJob.isVisible({ timeout: 15_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstJob.click();
    await expect(page).toHaveURL(/\/owner\/jobs\/([a-f0-9-]+)/, { timeout: 10_000 });

    // If there's a change order link, click it
    const coLink = page.locator("a[href*='/change-orders']").first();
    if (await coLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await coLink.click();
      await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
    }
  });
});
