import { defineConfig, devices } from "@playwright/test";
import { ensureE2eEnvironmentLoaded } from "./e2e-real/helpers/load-e2e-process-env";

// Load approved .env.e2e before baseURL / projects evaluate.
ensureE2eEnvironmentLoaded({ requireSeedPassword: true });

const baseURL = (process.env.E2E_BASE_URL || "http://127.0.0.1:18080").trim();

function assertSafeBaseUrl(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing full-stack E2E baseURL host: ${host}`);
  }
  if ((process.env.E2E_TEST_MODE || "").trim() !== "true") {
    throw new Error("E2E_TEST_MODE must be true for full-stack Playwright config.");
  }
  if ((process.env.NODE_ENV || "").trim() !== "test") {
    throw new Error("NODE_ENV must be test for full-stack Playwright config.");
  }
}

assertSafeBaseUrl(baseURL);

export default defineConfig({
  testDir: "./e2e-real",
  // POST /auth/login is intentionally rate-limited (5 requests / 60s — a real,
  // unweakened anti-brute-force control). loginViaUi() now correctly waits out
  // a 429 via the server's own Retry-After instead of silently proceeding
  // unauthenticated (see e2e-real/helpers/auth.ts), but that legitimate backoff
  // can take ~60s on its own. Several specs call loginViaUi multiple times
  // (sequentially — workers: 1, fullyParallel: false below — but still within
  // the same 60s throttle window when a file has several tests), so the
  // per-test timeout must be comfortably larger than a single backoff cycle,
  // not just larger than the fast-path case.
  timeout: 150_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e-real-report" }],
    ["junit", { outputFile: "e2e-real-results/junit.xml" }]
  ],
  globalSetup: "./e2e-real/global-setup.ts",
  globalTeardown: "./e2e-real/global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: {
      "X-MaintainPro-E2E": "true"
    }
  },
  // Do NOT start Next.js directly — traffic must enter via E2E Nginx.
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      grep: /@full-stack|@security|@tenant|@erp-control|@smoke/
    },
    {
      // Focused CI gates only — excluded from full-suite project list.
      name: "chromium-gate",
      use: { ...devices["Desktop Chrome"] },
      grep: /@wo-lifecycle-gate|@inventory-gate|@procurement-gate|@management-info-gate|@operations-gate/
    },
    {
      name: "mobile-smoke",
      use: { ...devices["Pixel 5"] },
      grep: /@smoke/
    }
  ]
});