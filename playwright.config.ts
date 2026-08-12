import { defineConfig, devices } from "@playwright/test";

const local = process.env.E2E_LOCAL === "1";
const baseURL = local
  ? "http://localhost:3000"
  : process.env.E2E_BASE_URL || "https://www.ichigoichiematcha.fr";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: local
    ? {
        // Test the production build, not Turbopack dev mode.
        // CI already runs `npm run build` in the previous workflow step.
        command: process.env.CI
          ? "npm run start -- --hostname localhost"
          : "npm run build && npm run start -- --hostname localhost",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
