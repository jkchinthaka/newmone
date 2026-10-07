import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  // Legacy mocked UI specs live as flat files under e2e/*.spec.ts.
  // Production-oriented QA suites use playwright.qa.config.ts + e2e/<domain>/.
  testMatch: ["*.spec.ts"],
  testIgnore: [
    "**/smoke/**",
    "**/dashboard/**",
    "**/auth/**",
    "**/requests/**",
    "**/maintenance/**",
    "**/planning/**",
    "**/pm/**",
    "**/inspections/**",
    "**/assets/**",
    "**/fleet/**",
    "**/inventory/**",
    "**/vendors/**",
    "**/costs/**",
    "**/approvals/**",
    "**/reports/**",
    "**/admin/**",
    "**/rbac/**",
    "**/cross-module/**",
    "**/a11y/**",
    "**/responsive/**",
    "**/helpers/**",
    "**/fixtures/**",
    "**/auth.setup.ts"
  ],
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3001/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] }
    }
  ]
});
