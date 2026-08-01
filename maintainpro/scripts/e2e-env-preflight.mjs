#!/usr/bin/env node
/**
 * Safe E2E environment preflight. Never prints credential values.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const {
  e2eEnvironmentPreflight,
  printE2eEnvironmentPreflight
} = require("./lib/e2e-environment.cjs");

const report = e2eEnvironmentPreflight();
const ok = printE2eEnvironmentPreflight(report);
if (!ok) {
  console.error("E2E environment preflight failed (no secret values shown).");
  process.exit(1);
}