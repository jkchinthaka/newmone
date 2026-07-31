#!/usr/bin/env node
/**
 * Safe E2E evidence manifest generator. Never includes secrets/cookies/tokens/URLs with credentials.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadE2eEnvOnly, assertE2eBaseUrl, assertComposeProjectName } from "./lib/e2e-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function main() {
  loadE2eEnvOnly();
  const base = assertE2eBaseUrl();
  const project = assertComposeProjectName();
  const manifest = {
    application: "maintainpro",
    gitCommitSha: (process.env.APP_COMMIT_SHA || process.env.GITHUB_SHA || "").trim() || "unknown",
    buildTimestampUtc: (process.env.APP_BUILD_TIMESTAMP || new Date().toISOString()).trim(),
    e2eRunId: (process.env.E2E_RUN_ID || "").trim(),
    composeProjectName: project,
    baseUrlHostname: base.hostname,
    suitesExecuted: (process.env.E2E_SUITES || "full-stack").split(",").map((s) => s.trim()),
    passed: Number(process.env.E2E_PASSED || 0),
    failed: Number(process.env.E2E_FAILED || 0),
    skipped: Number(process.env.E2E_SKIPPED || 0),
    browserProjects: ["chromium-desktop", "mobile-smoke"],
    serviceHealth: process.env.E2E_SERVICE_HEALTH || "UNKNOWN",
    reportFiles: [
      "apps/web/e2e-real-report/index.html",
      "apps/web/e2e-real-results/junit.xml"
    ],
    knownLimitations: [
      "CI thresholds are not production capacity claims",
      "Some workflow steps may skip when product gaps are detected"
    ],
    blockedTests: (process.env.E2E_BLOCKED_TESTS || "").split(",").filter(Boolean),
    dockerRuntime: process.env.E2E_DOCKER_RUNTIME || "UNKNOWN"
  };

  const json = JSON.stringify(manifest, null, 2);
  if (/mongodb:\/\//i.test(json) || /Bearer |password=/i.test(json)) {
    throw new Error("Evidence manifest contained forbidden secret-like content");
  }

  const outDir = path.join(root, "artifacts");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "e2e-evidence-manifest.json");
  writeFileSync(out, `${json}\n`, "utf8");
  console.log("Wrote artifacts/e2e-evidence-manifest.json (gitignored)");
}

main();