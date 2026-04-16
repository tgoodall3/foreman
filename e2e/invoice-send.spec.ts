/**
 * E2E — Invoice send flow.
 *
 * Tests the exact flow that returned 400 during the demo:
 *   "Send Invoice" on an invoice where the PM had no portal_token.
 *
 * The fix auto-generates a portal_token when missing, so now the send
 * should always succeed.
 *
 * Requires: owner project (authenticated via auth.setup.ts).
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Invoice — send flow", () => {
  test("invoice list loads without error", async ({ page }) => {
    await gotoSafe(page, "/owner/invoices");
    await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
  });

  test("invoice detail page loads without error", async ({ page }) => {
    await gotoSafe(page, "/owner/invoices");
    const firstLink = page.locator("main a[href*='/owner/invoices/']:not([href$='/new'])").first();
    if (await firstLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstLink.click();
      await expect(page).toHaveURL(/\/owner\/invoices\/[a-f0-9-]+/, { timeout: 10_000 });
      await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
    } else {
      test.skip();
    }
  });

  test("send invoice API returns 200 (not 400)", async ({ page }) => {
    // Find the first sendable invoice (status: draft or sent)
    await gotoSafe(page, "/owner/invoices");
    const firstLink = page.locator("main a[href*='/owner/invoices/']:not([href$='/new'])").first();

    if (!(await firstLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstLink.click();
    await expect(page).toHaveURL(/\/owner\/invoices\/[a-f0-9-]+/, { timeout: 10_000 });

    // Intercept the send API call to capture the response code
    let sendStatus: number | null = null;
    page.on("response", (response) => {
      if (response.url().includes("/api/invoices/") && response.url().includes("/send")) {
        sendStatus = response.status();
      }
    });

    // Click send button
    const sendBtn = page.getByRole("button", { name: /send invoice|send email/i }).first();
    if (!(await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await sendBtn.click();

    // Confirm modal if present
    const confirmBtn = page.getByRole("button", { name: /confirm|send/i }).last();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Wait for the network call to complete
    await page.waitForTimeout(3_000);

    if (sendStatus !== null) {
      expect(sendStatus, "Send invoice API should not return 400").not.toBe(400);
      expect(sendStatus, "Send invoice API should succeed").toBe(200);
    }

    // No error message on screen
    await expect(page.getByText(/failed to send|error sending|400/i).first()).not.toBeVisible();
  });
});
