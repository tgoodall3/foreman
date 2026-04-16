/**
 * Shared helpers for E2E tests.
 */
import { Page, expect } from "@playwright/test";

/** Navigate to a page and assert no 500 / error boundary is showing. */
export async function gotoSafe(page: Page, url: string) {
  const res = await page.goto(url);
  // Check HTTP status first (reliable when available)
  if (res && res.status() >= 500) {
    const body = await page.textContent("body");
    throw new Error(`Page ${url} returned HTTP ${res.status()}:\n${body?.slice(0, 400)}`);
  }
  // Next.js error boundaries render specific DOM elements — check for those
  // rather than scanning body text, which includes RSC streaming JSON that
  // can contain "500" as a number and trigger false positives.
  const errorHeading = page.locator("h1, h2").filter({
    hasText: /application error|internal server error|something went wrong/i,
  });
  const hasErrorBoundary = await errorHeading.first().isVisible({ timeout: 1_500 }).catch(() => false);
  if (hasErrorBoundary) {
    const body = await page.textContent("body");
    throw new Error(`Page ${url} rendered an error boundary:\n${body?.slice(0, 400)}`);
  }
  return res;
}

/** Fill a form field by its label text. */
export async function fillByLabel(page: Page, label: string | RegExp, value: string) {
  await page.getByLabel(label).fill(value);
}

/** Wait for a toast/success message matching text. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 8_000 });
}

/** Wait for a URL change that matches a pattern (after an action like form submit). */
export async function waitForNavTo(page: Page, pattern: RegExp) {
  await expect(page).toHaveURL(pattern, { timeout: 15_000 });
}

/** Click the first button matching a name and wait for any network activity to settle. */
export async function clickButton(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).first().click();
  await page.waitForLoadState("networkidle");
}
