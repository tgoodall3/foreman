/**
 * E2E — Portal invoice view via token (unauthenticated customer path).
 *
 * Tests the tokenized invoice URL flow — the one that was broken for
 * non-PM clients who don't have a portal account.
 *
 * The test visits /portal/invoice?token=<token>&invoice=<id> directly,
 * mimicking the link sent in the invoice email.
 *
 * Since we can't predict real tokens/IDs at test time, this test:
 *   - Verifies the page renders correctly for a valid token (happy path
 *     via a known test token set in E2E_PORTAL_TOKEN / E2E_INVOICE_ID)
 *   - Verifies the page shows a graceful error for an invalid token
 *     (not a 500 crash)
 *
 * Optional env vars (skip token tests if not set):
 *   E2E_PORTAL_TOKEN  — a real PM portal_token from the DB
 *   E2E_INVOICE_ID    — a real invoice UUID
 */
import { test, expect } from "@playwright/test";
import { gotoSafe } from "./helpers";

test.describe("Portal invoice — token-based access", () => {
  test("invalid token shows a graceful error, not a 500", async ({ page }) => {
    const res = await page.goto("/portal/invoice?token=definitely-not-valid&invoice=00000000-0000-0000-0000-000000000000");
    // Should not be a 500; a redirect to /login or a "not found" page is fine
    expect(res?.status() ?? 200).toBeLessThan(500);
    const body = await page.textContent("body");
    expect(body).not.toMatch(/internal server error|application error/i);
  });

  test("invoice page with real token renders without error", async ({ page }) => {
    const token    = process.env.E2E_PORTAL_TOKEN;
    const invoiceId = process.env.E2E_INVOICE_ID;

    if (!token || !invoiceId) {
      test.skip(); // skip if env not configured
      return;
    }

    await gotoSafe(page, `/portal/invoice?token=${token}&invoice=${invoiceId}`);

    // Page should show invoice details, not an error
    await expect(page.getByText(/invoice|total|due/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("heading", { name: /error|500/i })).not.toBeVisible();
  });

  test("payment button is present on payable invoice", async ({ page }) => {
    const token    = process.env.E2E_PORTAL_TOKEN;
    const invoiceId = process.env.E2E_INVOICE_ID;

    if (!token || !invoiceId) {
      test.skip();
      return;
    }

    await gotoSafe(page, `/portal/invoice?token=${token}&invoice=${invoiceId}`);

    // Either the Pay button or "payment received" should be visible
    const payBtn   = page.getByRole("button", { name: /pay.*securely|pay .*/i }).first();
    const paidText = page.getByText(/payment received|already paid/i).first();

    await expect(payBtn.or(paidText)).toBeVisible({ timeout: 8_000 });
  });
});
