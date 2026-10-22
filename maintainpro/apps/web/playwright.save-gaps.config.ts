import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3041";
if ((process.env.E2E_TEST_MODE || "").trim() !== "true") {
  throw new Error("E2E_TEST_MODE must be true");
}

export default defineConfig({
  testDir: "./e2e-real",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "off"
  },
  projects: [
    { name: "setup", testMatch: /save-gaps\.setup\.ts/ },
    {
      name: "gaps",
      testMatch: /save-gaps\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
