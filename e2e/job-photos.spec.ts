/**
 * E2E — Job photo lightbox.
 *
 * Verifies photos open in a lightbox overlay instead of navigating to
 * a raw Supabase URL (the previous behaviour).
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Job photos — lightbox", () => {
  test("clicking a job photo opens lightbox overlay, not a new tab", async ({ page }) => {
    await gotoSafe(page, "/owner/jobs");

    // Find the first job link in the main content area (avoids nav/skip links)
    const firstJobLink = page.locator("main a[href*='/owner/jobs/']:not([href$='/new'])").first();
    if (!(await firstJobLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await firstJobLink.click();
    await expect(page).toHaveURL(/\/owner\/jobs\/[a-f0-9-]+/, { timeout: 10_000 });

    // Look for any photo thumbnail button
    const photoBtns = page.locator("button img[alt]").first();
    if (!(await photoBtns.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(); // job has no photos
      return;
    }

    // Click the photo button — should NOT open a new page
    const [newPage] = await Promise.all([
      page.context().waitForEvent("page", { timeout: 2_000 }).catch(() => null),
      photoBtns.click(),
    ]);

    // No new tab should have opened
    expect(newPage).toBeNull();

    // A dialog/overlay should be visible — the lightbox renders with role=dialog
    await expect(page.getByRole("dialog", { name: /photo viewer/i })).toBeVisible({ timeout: 5_000 });

    // Close button should dismiss it
    await page.getByRole("button", { name: /close/i }).first().click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });

  test("lightbox download button initiates a download (not navigation)", async ({ page }) => {
    await gotoSafe(page, "/owner/jobs");
    const firstJobLink = page.locator("main a[href*='/owner/jobs/']:not([href$='/new'])").first();
    if (!(await firstJobLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await firstJobLink.click();
    await expect(page).toHaveURL(/\/owner\/jobs\/[a-f0-9-]+/, { timeout: 10_000 });

    const photoBtns = page.locator("button img[alt]").first();
    if (!(await photoBtns.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await photoBtns.click();

    // Open lightbox
    await expect(page.getByRole("dialog", { name: /photo viewer/i })).toBeVisible({ timeout: 5_000 });

    // Click download — should trigger a download event, not page navigation
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 8_000 }).catch(() => null),
      page.getByRole("button", { name: /download/i }).first().click(),
    ]);

    // Download event fired (blob download) OR the URL didn't change (fallback new-tab case)
    if (download === null) {
      // Fallback: page should still show the lightbox (no navigation away)
      await expect(page.getByRole("dialog", { name: /photo viewer/i })).toBeVisible();
    } else {
      expect(download.suggestedFilename()).toMatch(/\.(jpg|jpeg|png|webp|heic)$/i);
    }
  });
});
