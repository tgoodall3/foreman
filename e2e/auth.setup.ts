/**
 * Authenticates as the owner once and saves session cookies so all owner
 * tests can skip the login page.
 *
 * Required env vars (can be .env.test.local or CI secrets):
 *   E2E_OWNER_EMAIL    — owner account email
 *   E2E_OWNER_PASSWORD — owner account password
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/owner.json");

setup("authenticate as owner", async ({ page }) => {
  const email    = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD must be set.\n" +
      "Add them to a .env.test.local file or your CI environment."
    );
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Wait for navigation or an auth error to appear
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // Surface credential errors immediately rather than timing out on toHaveURL
  const loginError = await page.getByText(/invalid|incorrect|wrong password|no account|error|too many|rate.?limit|please wait/i)
    .first().textContent({ timeout: 2_000 }).catch(() => null);
  if (loginError) {
    throw new Error(`Login failed — check E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD.\nPage says: "${loginError}"`);
  }

  // Should land on the owner dashboard
  await expect(page).toHaveURL(/\/owner/, { timeout: 20_000 });

  // Persist the auth cookies/storage state
  await page.context().storageState({ path: authFile });
});
