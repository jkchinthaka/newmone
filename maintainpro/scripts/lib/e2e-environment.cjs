/**
 * Centralized disposable E2E environment loader (CommonJS for Playwright + Node).
 * Never logs secret values. Never returns the full environment object.
 *
 * Precedence: explicit process.env > approved .env.e2e file > none
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const maintainproRoot = path.resolve(__dirname, "..", "..");

const FORBIDDEN_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
  ".env.render"
]);

let loadedOnce = false;
let loadedPath = null;

function safeFail(message) {
  // Never interpolate secret values into errors.
  const err = new Error(message);
  err.name = "E2eEnvironmentError";
  throw err;
}

function isInsideMaintainPro(resolvedPath) {
  const root = path.resolve(maintainproRoot) + path.sep;
  const target = path.resolve(resolvedPath);
  return target === path.resolve(maintainproRoot) || target.startsWith(root);
}

function assertApprovedE2eBasename(filePath) {
  const base = path.basename(filePath);
  const lower = base.toLowerCase();
  if (FORBIDDEN_BASENAMES.has(lower)) {
    safeFail("E2E environment loader refused a non-E2E / production environment file.");
  }
  if (lower.includes("production") || lower.includes(".render")) {
    safeFail("E2E environment loader refused a production-like environment file.");
  }
  // Must identify as E2E-only configuration.
  if (!(lower === ".env.e2e" || lower === ".env.e2e.example" || /^\.env\.e2e(\.|$)/.test(lower))) {
    safeFail("E2E environment loader refused a file whose name is not E2E-only.");
  }
}

/**
 * Resolve the approved E2E env file path.
 * Relative paths resolve against MaintainPro root.
 * Absolute paths must stay inside MaintainPro root.
 */
function resolveApprovedE2eEnvPath(options = {}) {
  const preferredRaw = String(
    options.envFilePath || process.env.MAINTAINPRO_E2E_ENV_FILE || ""
  ).trim();

  let candidate;
  if (preferredRaw) {
    if (preferredRaw.includes("\0")) {
      safeFail("E2E environment loader refused an invalid environment file path.");
    }
    candidate = path.isAbsolute(preferredRaw)
      ? path.normalize(preferredRaw)
      : path.resolve(maintainproRoot, preferredRaw);
  } else {
    candidate = path.join(maintainproRoot, ".env.e2e");
  }

  if (!isInsideMaintainPro(candidate)) {
    safeFail("E2E environment loader refused a path outside the MaintainPro repository root.");
  }

  assertApprovedE2eBasename(candidate);

  if (fs.existsSync(candidate)) {
    return candidate;
  }

  // Fallback to committed fixture only when .env.e2e is absent (local convenience).
  const example = path.join(maintainproRoot, ".env.e2e.example");
  if (!preferredRaw && fs.existsSync(example)) {
    assertApprovedE2eBasename(example);
    return example;
  }

  safeFail("Required disposable E2E environment file is unavailable.");
}

/**
 * Load key=value pairs without overriding explicit process.env values.
 * Does not log values.
 */
function loadEnvFileNonOverriding(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function assertE2eSeedPasswordPresent() {
  const password = (process.env.E2E_SEED_PASSWORD || "").trim();
  if (!password) {
    safeFail(
      "Required disposable E2E credential E2E_SEED_PASSWORD is unavailable."
    );
  }
}

function assertPostLoadGuards(options = {}) {
  const nodeEnv = (process.env.NODE_ENV || "").trim();
  const e2eMode = (process.env.E2E_TEST_MODE || "").trim();
  if (nodeEnv !== "test") {
    safeFail("E2E environment loader: NODE_ENV must be exactly 'test'.");
  }
  if (e2eMode !== "true") {
    safeFail("E2E environment loader: E2E_TEST_MODE must be exactly 'true'.");
  }

  const runId = (process.env.E2E_RUN_ID || "").trim();
  if (!runId) {
    safeFail("E2E environment loader: E2E_RUN_ID is required.");
  }

  const project = (process.env.COMPOSE_PROJECT_NAME || "").trim();
  if (!project.startsWith("maintainpro-e2e-")) {
    safeFail("E2E environment loader: COMPOSE_PROJECT_NAME must start with 'maintainpro-e2e-'.");
  }

  const baseUrl = (process.env.E2E_BASE_URL || "").trim();
  if (!baseUrl) {
    safeFail("E2E environment loader: E2E_BASE_URL is required.");
  }
  let host;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    safeFail("E2E environment loader: E2E_BASE_URL is not a valid URL.");
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    safeFail("E2E environment loader: E2E_BASE_URL host must be loopback.");
  }

  const dbName =
    (process.env.PRIMARY_DATABASE_NAME || "").trim() ||
    (process.env.MONGO_DATABASE_NAME || "").trim();
  if (!dbName.startsWith("maintainpro_e2e_")) {
    safeFail("E2E environment loader: database name must start with 'maintainpro_e2e_'.");
  }

  if ((process.env.NOTIFICATION_REAL_SENDS_ENABLED || "").trim() === "true") {
    safeFail("E2E environment loader: live notification sends must be disabled.");
  }
  if ((process.env.ERP_WRITE_MODE || "").trim() === "true") {
    safeFail("E2E environment loader: ERP write mode must be disabled.");
  }

  if (options.requireSeedPassword !== false) {
    assertE2eSeedPasswordPresent();
  }
}

/**
 * Idempotent loader. Safe to call from Playwright config, helpers, and scripts.
 * @returns {{ loaded: boolean, pathBasename: string }}
 */
function ensureE2eEnvironmentLoaded(options = {}) {
  if (loadedOnce && !options.force) {
    if (options.requireSeedPassword !== false) {
      assertE2eSeedPasswordPresent();
    }
    return { loaded: true, pathBasename: path.basename(loadedPath || "") };
  }

  const filePath = resolveApprovedE2eEnvPath(options);
  loadEnvFileNonOverriding(filePath);
  loadedOnce = true;
  loadedPath = filePath;
  process.env.MAINTAINPRO_LOADED_ENV_FILES = path.basename(filePath);

  assertPostLoadGuards(options);

  return { loaded: true, pathBasename: path.basename(filePath) };
}

/**
 * Safe preflight report — never includes secret values.
 */
function e2eEnvironmentPreflight(options = {}) {
  const report = {
    envFileExists: false,
    nodeEnvValid: false,
    e2eModeValid: false,
    runIdPresent: false,
    seedCredentialPresent: false,
    baseUrlLoopback: false,
    databasePrefixValid: false,
    ok: false
  };

  try {
    const filePath = resolveApprovedE2eEnvPath(options);
    report.envFileExists = fs.existsSync(filePath);
    ensureE2eEnvironmentLoaded({ ...options, force: true });
    report.nodeEnvValid = (process.env.NODE_ENV || "").trim() === "test";
    report.e2eModeValid = (process.env.E2E_TEST_MODE || "").trim() === "true";
    report.runIdPresent = Boolean((process.env.E2E_RUN_ID || "").trim());
    report.seedCredentialPresent = Boolean((process.env.E2E_SEED_PASSWORD || "").trim());
    try {
      const host = new URL((process.env.E2E_BASE_URL || "").trim()).hostname.toLowerCase();
      report.baseUrlLoopback = host === "127.0.0.1" || host === "localhost";
    } catch {
      report.baseUrlLoopback = false;
    }
    const dbName =
      (process.env.PRIMARY_DATABASE_NAME || "").trim() ||
      (process.env.MONGO_DATABASE_NAME || "").trim();
    report.databasePrefixValid = dbName.startsWith("maintainpro_e2e_");
    report.ok =
      report.envFileExists &&
      report.nodeEnvValid &&
      report.e2eModeValid &&
      report.runIdPresent &&
      report.seedCredentialPresent &&
      report.baseUrlLoopback &&
      report.databasePrefixValid;
  } catch {
    report.ok = false;
  }
  return report;
}

function printE2eEnvironmentPreflight(report) {
  const lines = [
    `E2E environment preflight: ${report.ok ? "PASS" : "FAIL"}`,
    `E2E environment file exists: ${report.envFileExists ? "yes" : "no"}`,
    `NODE_ENV valid: ${report.nodeEnvValid ? "yes" : "no"}`,
    `E2E_TEST_MODE valid: ${report.e2eModeValid ? "yes" : "no"}`,
    `E2E run ID present: ${report.runIdPresent ? "yes" : "no"}`,
    `E2E seed credential present: ${report.seedCredentialPresent ? "YES" : "NO"}`,
    `base URL loopback: ${report.baseUrlLoopback ? "yes" : "no"}`,
    `E2E database prefix valid: ${report.databasePrefixValid ? "yes" : "no"}`
  ];
  for (const line of lines) {
    console.log(line);
  }
  return report.ok;
}

/** Test-only reset — not for production use. */
function __resetE2eEnvironmentLoaderForTests() {
  loadedOnce = false;
  loadedPath = null;
}

module.exports = {
  maintainproRoot,
  resolveApprovedE2eEnvPath,
  ensureE2eEnvironmentLoaded,
  e2eEnvironmentPreflight,
  printE2eEnvironmentPreflight,
  assertE2eSeedPasswordPresent,
  __resetE2eEnvironmentLoaderForTests
};