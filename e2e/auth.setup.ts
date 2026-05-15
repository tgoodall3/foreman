/**
 * Authenticates as the owner once and saves session cookies so all owner
 * tests can skip the login page.
 *
 * Reuses the existing session in .auth/owner.json if it is still valid,
 * avoiding repeated Supabase sign-in attempts (which trigger rate limiting).
 *
 * Required env vars (can be .env.test.local or CI secrets):
 *   E2E_OWNER_EMAIL    — owner account email
 *   E2E_OWNER_PASSWORD — owner account password
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, ".auth/owner.json");

async function sessionIsValid(page: import("@playwright/test").Page): Promise<boolean> {
  try {
    // Navigate to a protected page — if we land there, session is good
    const res = await page.goto("/owner", { waitUntil: "load", timeout: 10_000 });
    return page.url().includes("/owner") && (res?.status() ?? 0) < 400;
  } catch {
    return false;
  }
}

setup("authenticate as owner", async ({ page, browser }) => {
  const email    = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD must be set.\n" +
      "Add them to a .env.test.local file or your CI environment."
    );
  }

  // Reuse saved session if it exists and is still valid
  if (fs.existsSync(authFile)) {
    const ctx = await browser.newContext({ storageState: authFile });
    const checkPage = await ctx.newPage();
    const valid = await sessionIsValid(checkPage);
    await ctx.close();

    if (valid) {
      // Session still good — skip the login entirely
      return;
    }
  }

  // Session missing or expired — do a fresh UI login
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  const loginError = await page
    .getByText(/invalid|incorrect|wrong password|no account|error|too many|rate.?limit|please wait/i)
    .first().textContent({ timeout: 2_000 }).catch(() => null);
  if (loginError) {
    throw new Error(
      `Login failed — check E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD.\nPage says: "${loginError}"`
    );
  }

  await expect(page).toHaveURL(/\/owner/, { timeout: 20_000 });
  await page.context().storageState({ path: authFile });
});
