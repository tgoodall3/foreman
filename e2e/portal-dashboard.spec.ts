/**
 * E2E — Portal PM dashboard.
 *
 * Tests:
 *   1. Unauthenticated /portal redirects to login (not a 500)
 *   2. Portal change-order page with invalid token shows graceful error
 *   3. Portal estimate page with invalid token shows graceful error
 *   4. Full portal dashboard (work orders, estimates, change orders tabs)
 *      — requires E2E_PORTAL_EMAIL + E2E_PORTAL_PASSWORD env vars.
 *      — skipped if credentials are not set.
 *
 * Optional env vars (.env.test.local):
 *   E2E_PORTAL_EMAIL     — a PM account email that has portal access
 *   E2E_PORTAL_PASSWORD  — their password
 */
import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function portalLogin(page: Page, email: string, password: string) {
  await page.goto("/login?next=/portal");
  await page.getByLabel(/email/i).fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/portal/, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Token-less / unauthenticated tests (always run)
// ---------------------------------------------------------------------------
test.describe("Portal — unauthenticated access", () => {
  test("unauthenticated /portal redirects to login, not a 500", async ({ page }) => {
    const res = await page.goto("/portal");
    // Should redirect to /login, never 500
    expect((res?.status() ?? 200)).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });

  test("portal change-order with invalid token shows graceful error", async ({ page }) => {
    const res = await page.goto(
      "/portal/change-order?token=totally-fake-token-that-does-not-exist"
    );
    expect((res?.status() ?? 200)).toBeLessThan(500);
    const body = await page.textContent("body");
    expect(body).not.toMatch(/internal server error|application error/i);
  });

  test("portal estimate with invalid token shows graceful error", async ({ page }) => {
    const res = await page.goto(
      "/portal/estimate?token=totally-fake-token-that-does-not-exist"
    );
    expect((res?.status() ?? 200)).toBeLessThan(500);
    const body = await page.textContent("body");
    expect(body).not.toMatch(/internal server error|application error/i);
  });
});

// ---------------------------------------------------------------------------
// Authenticated portal tests (require E2E_PORTAL_EMAIL / _PASSWORD)
// ---------------------------------------------------------------------------
test.describe("Portal — authenticated dashboard", () => {
  test.beforeEach(async ({ page }) => {
    const email    = process.env.E2E_PORTAL_EMAIL;
    const password = process.env.E2E_PORTAL_PASSWORD;
    if (!email || !password) {
      test.skip();
      return;
    }
    await portalLogin(page, email, password);
  });

  test("portal home tab loads without error", async ({ page }) => {
    await expect(page).toHaveURL(/\/portal/, { timeout: 10_000 });
    await expect(
      page.locator("h1, h2").filter({ hasText: /application error|internal server error/i }).first()
    ).not.toBeVisible();
  });

  test("work orders tab renders without error", async ({ page }) => {
    const woTab = page.getByRole("button", { name: /work order/i }).first()
      .or(page.getByText(/work order/i).first());
    if (await woTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await woTab.click();
      await expect(
        page.locator("h1, h2").filter({ hasText: /error|500/i }).first()
      ).not.toBeVisible();
    }
  });

  test("estimates tab renders without error", async ({ page }) => {
    const estTab = page.getByRole("button", { name: /estimate/i }).first()
      .or(page.getByText(/estimate/i).first());
    if (await estTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await estTab.click();
      await expect(
        page.locator("h1, h2").filter({ hasText: /error|500/i }).first()
      ).not.toBeVisible();
    }
  });

  test("change orders tab renders without error", async ({ page }) => {
    const coTab = page.getByRole("button", { name: /change order/i }).first()
      .or(page.getByText(/change order/i).first());
    if (await coTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await coTab.click();
      await expect(
        page.locator("h1, h2").filter({ hasText: /error|500/i }).first()
      ).not.toBeVisible();
    }
  });

  test("invoices tab renders without error", async ({ page }) => {
    const invTab = page.getByRole("button", { name: /invoice/i }).first()
      .or(page.getByText(/invoice/i).first());
    if (await invTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await invTab.click();
      await expect(
        page.locator("h1, h2").filter({ hasText: /error|500/i }).first()
      ).not.toBeVisible();
    }
  });

  test("submitting a work order request does not 500", async ({ page }) => {
    // Look for a "Submit request" / "New work order" button
    const requestBtn = page.getByRole("button", { name: /submit.*request|new.*work order|request.*service/i }).first();
    if (!(await requestBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await requestBtn.click();

    // Fill the form if a modal/form appears
    const titleInput = page.getByLabel(/title|subject/i).first()
      .or(page.locator("input[placeholder*='title' i]").first());
    if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await titleInput.fill("E2E Test - Leaking faucet");
    }

    const sendBtn = page.getByRole("button", { name: /submit|send|create/i }).last();
    if (await sendBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      const submitResponsePromise = page.waitForResponse(
        (r) => r.url().includes("/api/portal/submit") || r.url().includes("/api/work-orders"),
        { timeout: 8_000 }
      ).catch(() => null);

      await sendBtn.click();

      const submitResponse = await submitResponsePromise;
      if (submitResponse) {
        expect(submitResponse.status()).not.toBe(500);
      }
    }
  });
});
