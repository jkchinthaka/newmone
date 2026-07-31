#!/usr/bin/env node
/**
 * Materialize maintainpro/.env.e2e from .env.e2e.example with runtime overrides.
 * Never prints secret values or full env-file contents.
 *
 * Usage (from maintainpro/):
 *   node scripts/e2e-materialize-env.mjs
 *
 * Reads overrides from process.env:
 *   E2E_RUN_ID, COMPOSE_PROJECT_NAME, APP_COMMIT_SHA, APP_BUILD_TIMESTAMP
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const {
  materializeE2eEnvFile,
  buildEmailLocal,
  assertGeneratedEmailStructure
} = require("./lib/e2e-env-materialize.cjs");

function requiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    console.error(`E2E materialize: missing required environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

const templatePath = path.join(maintainproRoot, ".env.e2e.example");
const destPath = path.join(maintainproRoot, ".env.e2e");

const overrides = {
  E2E_RUN_ID: requiredEnv("E2E_RUN_ID"),
  COMPOSE_PROJECT_NAME: requiredEnv("COMPOSE_PROJECT_NAME")
};

if ((process.env.APP_COMMIT_SHA || "").trim()) {
  overrides.APP_COMMIT_SHA = process.env.APP_COMMIT_SHA.trim();
}
if ((process.env.APP_BUILD_TIMESTAMP || "").trim()) {
  overrides.APP_BUILD_TIMESTAMP = process.env.APP_BUILD_TIMESTAMP.trim();
}

try {
  const result = materializeE2eEnvFile({
    templatePath,
    destPath,
    overrides,
    expectDomainExact: true
  });

  const email = buildEmailLocal(
    "admin-a",
    overrides.E2E_RUN_ID,
    "e2e.maintainpro.test"
  );
  assertGeneratedEmailStructure(email);

  console.log("E2E environment template final newline: PASS");
  console.log("E2E runtime append boundary: PASS");
  console.log("E2E materialized variable separation: PASS");
  console.log(`E2E materialize keys written: ${result.keys.length}`);
  console.log(`E2E domain ok: ${result.domainOk ? "yes" : "no"}`);
  console.log(`E2E run id present: ${result.runIdPresent ? "yes" : "no"}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "materialize failed";
  console.error(`E2E materialize FAIL — ${message}`);
  process.exit(1);
}
