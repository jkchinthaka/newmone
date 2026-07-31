async function globalTeardown() {
  // Never touch non-E2E data. Explicit cleanup is operator/CI-driven via e2e-cleanup.mjs.
  if ((process.env.E2E_AUTO_CLEANUP || "").trim() === "true") {
    const { execFileSync } = await import("node:child_process");
    const path = await import("node:path");
    const maintainproRoot = path.resolve(__dirname, "../../..");
    const runId = (process.env.E2E_RUN_ID || "").trim();
    execFileSync("node", ["scripts/e2e-cleanup.mjs"], {
      cwd: maintainproRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        CONFIRM_E2E_CLEANUP: `DELETE_E2E_RUN_${runId}`
      }
    });
  }
}

export default globalTeardown;