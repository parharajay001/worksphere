import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm.cmd run start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  reporter: [["list"]],
});
