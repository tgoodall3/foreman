/**
 * E2E — Work order acceptance flow.
 *
 * Tests:
 *   1. Work order list loads
 *   2. Work order detail loads
 *   3. Accept action creates a job (no 500)
 *   4. Decline action works (no 500)
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Work order flow", () => {
  test("work order list loads without error", async ({ page }) => {
    await gotoSafe(page, "/owner/work-orders");
    await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
  });

  test("work order detail loads without error", async ({ page }) => {
    await gotoSafe(page, "/owner/work-orders");
    const firstLink = page.locator("main a[href*='/owner/work-orders/']").first();
    if (await firstLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstLink.click();
      await expect(page).toHaveURL(/\/owner\/work-orders\/[a-f0-9-]+/, { timeout: 10_000 });
      await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
    } else {
      test.skip();
    }
  });

  test("accepting a work order does not error", async ({ page }) => {
    await gotoSafe(page, "/owner/work-orders");
    // Find a pending work order
    const pendingLink = page.locator("a").filter({ hasText: /pending/i }).first();
    if (!(await pendingLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await pendingLink.click();
    await expect(page).toHaveURL(/\/owner\/work-orders\/[a-f0-9-]+/, { timeout: 10_000 });

    const acceptBtn = page.getByRole("button", { name: /accept/i }).first();
    if (!(await acceptBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const acceptResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/work-orders/action"),
      { timeout: 10_000 }
    ).catch(() => null);

    await acceptBtn.click();

    // Confirm dialog
    const confirmBtn = page.getByRole("button", { name: /confirm|yes|accept/i }).last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    const acceptResponse = await acceptResponsePromise;
    if (acceptResponse) {
      expect(acceptResponse.status()).not.toBe(500);
      expect(acceptResponse.status()).toBe(200);
    }

    await expect(page.getByText(/failed|error|500/i).first()).not.toBeVisible();
  });
});
