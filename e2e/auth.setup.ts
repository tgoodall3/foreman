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
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Should land on the owner dashboard
  await expect(page).toHaveURL(/\/owner/, { timeout: 15_000 });

  // Persist the auth cookies/storage state
  await page.context().storageState({ path: authFile });
});
