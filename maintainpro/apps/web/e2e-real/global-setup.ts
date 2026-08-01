import { execFileSync } from "node:child_process";
import path from "node:path";
import { ensureE2eEnvironmentLoaded } from "./helpers/load-e2e-process-env";

async function globalSetup() {
  ensureE2eEnvironmentLoaded({ requireSeedPassword: true });

  if ((process.env.E2E_TEST_MODE || "").trim() !== "true") {
    throw new Error("global-setup: E2E_TEST_MODE must be true");
  }
  if ((process.env.NODE_ENV || "").trim() !== "test") {
    throw new Error("global-setup: NODE_ENV must be test");
  }
  const baseURL = (process.env.E2E_BASE_URL || "").trim();
  if (!baseURL.includes("127.0.0.1") && !baseURL.includes("localhost")) {
    throw new Error("global-setup: refusing non-loopback E2E_BASE_URL");
  }

  const maintainproRoot = path.resolve(__dirname, "../../..");
  execFileSync("node", ["scripts/validate-e2e-safety.mjs"], {
    cwd: maintainproRoot,
    stdio: "inherit",
    env: process.env
  });
  execFileSync("node", ["scripts/e2e-verify-isolation.mjs"], {
    cwd: maintainproRoot,
    stdio: "inherit",
    env: process.env
  });

  // Seed is optional when SKIP_E2E_SEED=true (data already present).
  if ((process.env.SKIP_E2E_SEED || "").trim() !== "true") {
    try {
      execFileSync("node", ["scripts/e2e-seed.mjs"], {
        cwd: maintainproRoot,
        stdio: "inherit",
        env: process.env
      });
    } catch (error) {
      console.warn(
        "global-setup: seed failed (stack may be unavailable). Suites that need data will fail closed."
      );
      console.warn(String((error as Error).message || error));
    }
  }
}

export default globalSetup;