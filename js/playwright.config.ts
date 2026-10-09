import { defineConfig, devices } from "@playwright/test";

const PORT = 8099;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 15_000 },
  // The specs share one gotty server and a fixed scratch directory on disk, so
  // run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bash e2e/start-gotty.sh",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
