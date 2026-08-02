#!/usr/bin/env node
/**
 * Fixture-only production configuration validator.
 * Never reads real .env; never prints secret values.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseEnvText,
  validateProductionConfig
} from "./lib/production-config-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const FIXTURE_CANDIDATES = [
  path.join(root, ".env.production.security-fixture.example"),
  path.join(root, ".env.production.structure-fixture.example")
];

let failures = 0;
let passes = 0;

function pass(id, msg) {
  passes += 1;
  console.log(`PASS ${id}: ${msg}`);
}

function fail(id, msg) {
  failures += 1;
  console.error(`FAIL ${id}: ${msg}`);
}

console.log("validate:production-configuration — fixture only (no secrets printed)\n");

if (process.env.MAINTAINPRO_READ_REAL_ENV === "true") {
  fail("PROD-CFG-000", "Validators must not read real .env");
  process.exit(1);
}

const fixturePath = FIXTURE_CANDIDATES.find((p) => existsSync(p));
if (!fixturePath) {
  fail("PROD-CFG-001", "No production security/structure fixture found");
  process.exit(1);
}

const basename = path.basename(fixturePath);
if (basename === ".env" || basename.endsWith(".env.local")) {
  fail("PROD-CFG-002", "Refusing real env basename");
  process.exit(1);
}

pass("PROD-CFG-001", `loaded fixture basename=${basename}`);

const env = parseEnvText(readFileSync(fixturePath, "utf8"));
const result = validateProductionConfig(env, { requireAll: true });

if (result.ok) {
  pass("PROD-CFG-010", "production fixture validates");
} else {
  for (const f of result.findings) {
    fail(
      "PROD-CFG-010",
      `${f.variable} [${f.classification}/${f.category}] ${f.message}`
    );
  }
}

// Negative cases (inline fixtures — no secrets of production length with weak content)
const negatives = [
  {
    id: "SEC-CONFIG-002",
    env: { ...env, JWT_ACCESS_SECRET: "short" },
    expectCategory: "short_secret"
  },
  {
    id: "SEC-CONFIG-003",
    env: { ...env, JWT_ACCESS_SECRET: "changeme-changeme-changeme-changeme" },
    expectCategory: "placeholder_secret"
  },
  {
    id: "SEC-CONFIG-004",
    env: { ...env, FRONTEND_URL: "https://localhost:3001" },
    expectCategory: "localhost_url"
  },
  {
    id: "SEC-CONFIG-005",
    env: { ...env, CORS_ORIGIN: "https://*.example.com" },
    expectCategory: "wildcard_cors"
  },
  {
    id: "SEC-CONFIG-006",
    env: { ...env, COOKIE_SECURE: "false", ALLOW_INSECURE_HTTP: "false" },
    expectCategory: "insecure_cookie_mismatch"
  },
  {
    id: "SEC-CONFIG-007",
    env: { ...env, APP_COMMIT_SHA: "not-a-sha" },
    expectCategory: "malformed_release_sha"
  },
  {
    id: "SEC-CONFIG-008",
    env: { ...env, E2E_TEST_MODE: "true" },
    expectCategory: "e2e_flag_in_production"
  }
];

for (const caseItem of negatives) {
  const r = validateProductionConfig(caseItem.env, { requireAll: false });
  const hit = r.findings.some((f) => f.category === caseItem.expectCategory);
  if (hit) pass(caseItem.id, `rejects ${caseItem.expectCategory}`);
  else fail(caseItem.id, `expected category ${caseItem.expectCategory}`);
}

console.log(`\nSummary: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
