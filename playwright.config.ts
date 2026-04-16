import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Load test-specific env vars (E2E credentials, portal tokens, etc.)
loadEnv({ path: ".env.test.local" });

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // keep sequential so auth state is predictable
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  // Reuse signed-in state across tests
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "owner",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/owner.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "portal",
      testMatch: /.*portal-invoice\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
      // Portal uses token-based auth — no stored state needed
    },
  ],
});
