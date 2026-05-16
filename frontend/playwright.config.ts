import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Builds + serves the production app, then runs the keystone
 * parity test and the user-flow test against it. Pyodide first-load is slow,
 * so timeouts are generous.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
  },
});
