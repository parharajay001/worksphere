import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm.cmd run start -- -p 3100",
    env: {
      APP_URL: "http://localhost:3100",
      EMAIL_DELIVERY_PREVIEW: "true",
    },
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  reporter: [["list"]],
});
