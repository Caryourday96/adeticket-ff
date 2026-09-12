import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node dist/server.cjs",
    url: "http://127.0.0.1:3107/api/health",
    reuseExistingServer: false,
    env: {
      NODE_ENV: "test",
      PORT: "3107",
      APP_ORIGIN: "http://127.0.0.1:3107",
      HOST_PASSWORD: "local-e2e-fixture-only",
      DATA_DIR: `.data/e2e-${Date.now()}`,
    },
  },
});
