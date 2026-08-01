#!/usr/bin/env node
/**
 * Structural E2E safety validator. Never prints secret values.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertAllE2eGuards,
  assertE2eDatabaseName,
  loadE2eEnvOnly
} from "./lib/e2e-guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const maintainproRoot = path.resolve(__dirname, "..");

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

function stripComments(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

function main() {
  console.log("validate:e2e-safety — structural checks only (no secret values)");
  const loaded = loadE2eEnvOnly();
  pass("E2E-SAFE-001", `loaded fixture env basename=${path.basename(loaded)}`);

  try {
    assertAllE2eGuards({ requireRunId: true });
    pass("E2E-SAFE-002", "core E2E guards passed");
  } catch (error) {
    fail("E2E-SAFE-002", error.message);
  }

  const composePath = path.join(maintainproRoot, "docker-compose.e2e.yml");
  if (!existsSync(composePath)) {
    fail("E2E-SAFE-003", "docker-compose.e2e.yml missing");
  } else {
    const text = stripComments(readFileSync(composePath, "utf8"));
    if (!/127\.0\.0\.1:\$\{E2E_HTTP_PORT/.test(text) && !/127\.0\.0\.1:\$\{E2E_HTTP_PORT:-18080\}:80/.test(text)) {
      // accept either interpolation form
      if (!text.includes('127.0.0.1:${E2E_HTTP_PORT:-18080}:80')) {
        fail("E2E-SAFE-003", "Nginx must bind to 127.0.0.1 only");
      } else {
        pass("E2E-SAFE-003", "Nginx bound to 127.0.0.1");
      }
    } else {
      pass("E2E-SAFE-003", "Nginx bound to 127.0.0.1");
    }
    if (/ports:\s*\n\s*-\s*"\d+:27017"/.test(text) || text.includes("0.0.0.0:27017")) {
      fail("E2E-SAFE-004", "Mongo must not be publicly published");
    } else {
      pass("E2E-SAFE-004", "Mongo not publicly published in e2e overlay");
    }
    if (!text.includes("maintainpro-e2e-mongo-data") || !text.includes("maintainpro-e2e-redis-data")) {
      fail("E2E-SAFE-005", "E2E volumes must be isolated");
    } else {
      pass("E2E-SAFE-005", "Isolated E2E volumes present");
    }
    if (!text.includes("API_INTERNAL_URL: http://api:3000/api") && !text.includes("API_INTERNAL_URL=http://api:3000/api")) {
      // yaml form
      if (!/API_INTERNAL_URL:\s*http:\/\/api:3000\/api/.test(text)) {
        fail("E2E-SAFE-006", "API_INTERNAL_URL must point to api:3000/api");
      } else {
        pass("E2E-SAFE-006", "API_INTERNAL_URL configured");
      }
    } else {
      pass("E2E-SAFE-006", "API_INTERNAL_URL configured");
    }
    if (!text.includes('E2E_TEST_MODE: "true"') && !text.includes("E2E_TEST_MODE: 'true'")) {
      fail("E2E-SAFE-007", "E2E_TEST_MODE must be true in compose");
    } else {
      pass("E2E-SAFE-007", "E2E_TEST_MODE=true in compose");
    }
    if (text.includes("maintainpro-mongo-data") && !text.includes("maintainpro-e2e-mongo-data")) {
      fail("E2E-SAFE-008", "Must not reuse production volume name alone");
    } else {
      pass("E2E-SAFE-008", "Production volume names not reused as primary");
    }
    if (!text.includes("docker-entrypoint-e2e.sh") || !text.includes("/e2e-entrypoint.sh")) {
      fail("E2E-SAFE-015", "Mongo E2E must use keyFile-capable entrypoint (auth+replSet)");
    } else {
      pass("E2E-SAFE-015", "Mongo E2E keyFile entrypoint wired");
    }
  }

  try {
    assertE2eDatabaseName(process.env.PRIMARY_DATABASE_NAME || "");
    pass("E2E-SAFE-009", "PRIMARY_DATABASE_NAME has E2E prefix");
  } catch (error) {
    fail("E2E-SAFE-009", error.message);
  }

  const exampleEnv = path.join(maintainproRoot, ".env.e2e.example");
  if (!existsSync(exampleEnv)) {
    fail("E2E-SAFE-010", ".env.e2e.example missing");
  } else {
    const envText = readFileSync(exampleEnv, "utf8");
    if (/PASSWORD=CHANGE_ME|root_password(?!_not)/i.test(envText) && envText.includes("nelna?")) {
      fail("E2E-SAFE-010", "example env looks production-like");
    } else {
      pass("E2E-SAFE-010", ".env.e2e.example present and disposable-named");
    }
  }

  const workflowPath = path.join(maintainproRoot, "..", ".github", "workflows", "full-stack-e2e.yml");
  if (existsSync(workflowPath)) {
    const wf = readFileSync(workflowPath, "utf8");
    const hardcodes =
      /E2E_SEED_PASSWORD:\s*\S+/.test(wf) ||
      /echo\s+["']?E2E_SEED_PASSWORD=/.test(wf) ||
      /GITHUB_ENV.*E2E_SEED_PASSWORD/.test(wf);
    if (hardcodes) {
      fail("E2E-SAFE-016", "Workflow must not hardcode or export E2E_SEED_PASSWORD");
    } else if (!wf.includes("MAINTAINPRO_E2E_ENV_FILE")) {
      fail("E2E-SAFE-016", "Workflow must pass MAINTAINPRO_E2E_ENV_FILE path");
    } else {
      pass("E2E-SAFE-016", "Workflow passes E2E env file path without password export");
    }

    const fragileEchoAppend =
      /echo\s+[\"']?E2E_RUN_ID=\$\{?E2E_RUN_ID\}?[\"']?\s*>>/.test(wf);
    const usesMaterialize = wf.includes("e2e-materialize-env");
    if (fragileEchoAppend || !usesMaterialize) {
      fail(
        "E2E-SAFE-017",
        "Workflow must use newline-safe materialize (not fragile echo append)"
      );
    } else {
      pass("E2E-SAFE-017", "E2E runtime append boundary: PASS");
    }

    if (!wf.includes("e2e-auth-path-diag") || !wf.includes("Auth path diagnostic")) {
      fail("E2E-SAFE-019", "Workflow must run three-level auth-path diagnostic before Playwright");
    } else if (/continue-on-error:\s*true[\s\S]{0,120}Auth path diagnostic|Auth path diagnostic[\s\S]{0,120}continue-on-error:\s*true/.test(wf)) {
      fail("E2E-SAFE-019", "Auth path diagnostic must not use continue-on-error");
    } else {
      pass("E2E-SAFE-019", "Auth path diagnostic gate present before Playwright");
    }
  }

  const e2eComposeForDiag = path.join(maintainproRoot, "docker-compose.e2e.yml");
  if (existsSync(e2eComposeForDiag)) {
    const diagText = readFileSync(e2eComposeForDiag, "utf8");
    if (!diagText.includes("e2e-auth-path-diag") || !diagText.includes("diagnostics")) {
      fail("E2E-SAFE-020", "E2E compose must define diagnostics-profile auth-path service");
    } else if (/e2e-auth-path-diag:[\s\S]*?ports:/.test(diagText)) {
      fail("E2E-SAFE-020", "Auth-path diagnostic service must not publish ports");
    } else {
      pass("E2E-SAFE-020", "Diagnostics-profile auth-path service is internal-only");
    }
  }

  const exampleEnvPath = path.join(maintainproRoot, ".env.e2e.example");
  if (existsSync(exampleEnvPath)) {
    const buf = readFileSync(exampleEnvPath);
    const endsLf = buf.length > 0 && buf[buf.length - 1] === 0x0a;
    const text = buf.toString("utf8");
    const domainMatch = text.match(/^E2E_SEED_EMAIL_DOMAIN=(.*)$/m);
    const domain = domainMatch ? domainMatch[1].trim() : "";
    const domainConcat = /[A-Za-z_][A-Za-z0-9_]*=/.test(domain);
    if (!endsLf) {
      fail("E2E-SAFE-018", "E2E environment template final newline: FAIL");
    } else if (domain !== "e2e.maintainpro.test" || domainConcat) {
      fail("E2E-SAFE-018", "E2E_SEED_EMAIL_DOMAIN assignment is malformed");
    } else {
      pass("E2E-SAFE-018", "E2E environment template final newline: PASS");
    }
  }

  console.log(`Summary: ${passes} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`validate:e2e-safety FAIL — ${error.message}`);
  process.exit(1);
}