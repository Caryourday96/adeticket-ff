import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "platform.spec.ts",
  outputDir: "test-results-platform",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3117",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/platform-test-server.mjs",
    url: "http://127.0.0.1:3117/api/health",
    reuseExistingServer: false,
  },
});
