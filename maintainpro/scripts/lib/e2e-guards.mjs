/**
 * Shared disposable-E2E safety guards. Never print secret values.
 */

import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  maintainproRoot,
  parseMongoUrl
} from "./database-identity.mjs";

const require = createRequire(import.meta.url);
const e2eEnvironment = require("./e2e-environment.cjs");

export const {
  ensureE2eEnvironmentLoaded,
  resolveApprovedE2eEnvPath,
  e2eEnvironmentPreflight,
  printE2eEnvironmentPreflight,
  assertE2eSeedPasswordPresent
} = e2eEnvironment;

export const FORBIDDEN_PRODUCTION_DB_NAMES = new Set([
  "nelna",
  "bileeta_db",
  "maintainpro",
  "production",
  "prod"
]);

export const FORBIDDEN_PRODUCTION_BUCKETS = new Set([
  "maintainpro-files",
  "production",
  "prod"
]);

export function assertE2eMode() {
  const nodeEnv = (process.env.NODE_ENV || "").trim();
  const e2eMode = (process.env.E2E_TEST_MODE || "").trim();
  if (nodeEnv !== "test") {
    throw new Error("E2E guard failed: NODE_ENV must be exactly 'test'.");
  }
  if (e2eMode !== "true") {
    throw new Error("E2E guard failed: E2E_TEST_MODE must be exactly 'true'.");
  }
}

export function assertE2eRunId() {
  const runId = (process.env.E2E_RUN_ID || "").trim();
  if (!runId) {
    throw new Error("E2E guard failed: E2E_RUN_ID is required.");
  }
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(runId)) {
    throw new Error("E2E guard failed: E2E_RUN_ID has an invalid format.");
  }
  return runId;
}

export function assertComposeProjectName(name = process.env.COMPOSE_PROJECT_NAME) {
  const project = String(name || "").trim();
  if (!project.startsWith("maintainpro-e2e-")) {
    throw new Error(
      "E2E guard failed: COMPOSE_PROJECT_NAME must start with 'maintainpro-e2e-'."
    );
  }
  if (/prod|production|nelna/i.test(project)) {
    throw new Error("E2E guard failed: Compose project name looks production-like.");
  }
  return project;
}

export function assertE2eDatabaseName(databaseName) {
  const name = String(databaseName || "").trim();
  if (!name.startsWith("maintainpro_e2e_")) {
    throw new Error(
      "E2E guard failed: database name must start with 'maintainpro_e2e_'."
    );
  }
  if (FORBIDDEN_PRODUCTION_DB_NAMES.has(name.toLowerCase())) {
    throw new Error("E2E guard failed: forbidden production database name.");
  }
  return name;
}

export function assertE2eBaseUrl(rawUrl = process.env.E2E_BASE_URL) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    throw new Error("E2E guard failed: E2E_BASE_URL is required.");
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("E2E guard failed: E2E_BASE_URL is not a valid URL.");
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("E2E guard failed: E2E_BASE_URL host must be 127.0.0.1 or localhost.");
  }
  return { hostname: host, origin: parsed.origin };
}

export function assertNoProductionEnvLoaded() {
  const loaded = (process.env.MAINTAINPRO_LOADED_ENV_FILES || "").toLowerCase();
  if (loaded.includes(".env.production") || loaded.includes(".env.render")) {
    throw new Error("E2E guard failed: production env file was loaded.");
  }
}

export function assertNotificationsDisabled() {
  if ((process.env.NOTIFICATION_REAL_SENDS_ENABLED || "").trim() === "true") {
    throw new Error("E2E guard failed: live notification sends must be disabled.");
  }
  if ((process.env.SMS_LIVE_MODE || "").trim() === "true") {
    throw new Error("E2E guard failed: SMS live mode must be disabled.");
  }
  if ((process.env.ERP_WRITE_MODE || "").trim() === "true") {
    throw new Error("E2E guard failed: ERP write mode must be disabled.");
  }
}

export function assertE2eBucket() {
  const bucket = (process.env.MINIO_BUCKET || "").trim();
  if (!bucket.startsWith("maintainpro-e2e")) {
    throw new Error("E2E guard failed: MINIO_BUCKET must start with 'maintainpro-e2e'.");
  }
  if (FORBIDDEN_PRODUCTION_BUCKETS.has(bucket.toLowerCase())) {
    throw new Error("E2E guard failed: production MinIO bucket is forbidden.");
  }
}

export function resolveE2eDatabaseIdentity() {
  const url =
    (process.env.PRIMARY_DATABASE_URL || "").trim() ||
    (process.env.DATABASE_URL || "").trim() ||
    (process.env.MONGODB_URI || "").trim();
  const parsed = parseMongoUrl(url);
  const explicit =
    (process.env.PRIMARY_DATABASE_NAME || "").trim() ||
    (process.env.MONGO_DATABASE_NAME || "").trim() ||
    "";
  const databaseName = explicit || parsed?.databaseName || "";
  assertE2eDatabaseName(databaseName);
  const host = (parsed?.host || "").toLowerCase();
  const allowedHost =
    !host ||
    host === "unknown" ||
    host.startsWith("mongo") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost");
  if (!allowedHost) {
    throw new Error("E2E guard failed: database host is not an allowed E2E host.");
  }
  return { url, databaseName, host: parsed?.host || "unknown", urlPresent: Boolean(url) };
}

/**
 * Backward-compatible loader — delegates to the centralized E2E environment module.
 */
export function loadE2eEnvOnly(options = {}) {
  ensureE2eEnvironmentLoaded(options);
  const preferredRelative = (process.env.MAINTAINPRO_E2E_ENV_FILE || "").trim();
  if (preferredRelative) {
    return path.isAbsolute(preferredRelative)
      ? preferredRelative
      : path.join(maintainproRoot, preferredRelative);
  }
  const preferred = path.join(maintainproRoot, ".env.e2e");
  if (existsSync(preferred)) return preferred;
  return path.join(maintainproRoot, ".env.e2e.example");
}

export function assertAllE2eGuards(options = {}) {
  ensureE2eEnvironmentLoaded({
    requireSeedPassword: options.requireSeedPassword !== false
  });
  assertE2eMode();
  if (options.requireRunId !== false) {
    assertE2eRunId();
  }
  assertComposeProjectName();
  assertE2eBaseUrl();
  assertNoProductionEnvLoaded();
  assertNotificationsDisabled();
  assertE2eBucket();
  return resolveE2eDatabaseIdentity();
}